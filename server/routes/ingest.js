import express from 'express';
import multer from 'multer';
import PendingAction from '../models/PendingAction.js';
import Subject from '../models/Subject.js';
import TimetableSlot from '../models/TimetableSlot.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import {
  parseTimetableFiles,
  parseHolidayFiles,
} from '../services/geminiIngest.js';

const router = express.Router();
router.use(requireAuth);

// In-memory buffer storage for multer (avoids disk I/O, supports up to 5 files per request)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
});

/**
 * POST /api/ingest/timetable
 * Upload up to 5 timetable images or PDFs to stage for user confirmation.
 */
router.post('/timetable', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'Please upload at least one timetable file (up to 5 images or PDFs).',
      });
    }

    const user = await User.findById(req.userId).select('department semester section');
    const studentContext = {
      department: req.body?.department || user?.department || '',
      semester: req.body?.semester || user?.semester || '',
      section: req.body?.section || user?.section || '',
      filterHint: req.body?.filterHint || '',
    };

    const extracted = await parseTimetableFiles(req.files, studentContext);

    // Human-in-the-Loop: Stage in PendingAction without directly modifying production tables
    const pendingAction = await PendingAction.create({
      userId: req.userId,
      agentType: 'TIMETABLE_INGEST',
      payload: extracted,
      summary: `Extracted ${extracted.subjects?.length || 0} subjects and ${extracted.timetableSlots?.length || 0} timetable slots from ${req.files.length} file(s).`,
      status: 'PENDING_APPROVAL',
    });

    return res.status(202).json({
      pendingActionId: pendingAction._id,
      status: 'PENDING_APPROVAL',
      payload: extracted,
    });
  } catch (error) {
    console.error('Error in /api/ingest/timetable:', error);
    return res.status(500).json({
      error: error.message || 'Failed to parse timetable file(s).',
    });
  }
});

/**
 * POST /api/ingest/holidays
 * Upload up to 5 holiday calendar images or PDFs to stage for user confirmation.
 */
router.post('/holidays', upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'Please upload at least one holiday calendar file (up to 5 images or PDFs).',
      });
    }

    const extracted = await parseHolidayFiles(req.files);

    const pendingAction = await PendingAction.create({
      userId: req.userId,
      agentType: 'TIMETABLE_INGEST',
      payload: extracted,
      summary: `Extracted ${extracted.holidays?.length || 0} holidays from ${req.files.length} file(s).`,
      status: 'PENDING_APPROVAL',
    });

    return res.status(202).json({
      pendingActionId: pendingAction._id,
      status: 'PENDING_APPROVAL',
      payload: extracted,
    });
  } catch (error) {
    console.error('Error in /api/ingest/holidays:', error);
    return res.status(500).json({
      error: error.message || 'Failed to parse holiday calendar file(s).',
    });
  }
});

/**
 * POST /api/ingest/confirm/:pendingActionId
 * Human-in-the-Loop confirmation: Writes edited or confirmed payload to MongoDB
 */
router.post('/confirm/:pendingActionId', async (req, res) => {
  try {
    const pendingAction = await PendingAction.findOne({
      _id: req.params.pendingActionId,
      userId: req.userId,
    });

    if (!pendingAction) {
      return res.status(404).json({ error: 'Pending action not found.' });
    }

    if (pendingAction.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        error: `Cannot confirm action with status ${pendingAction.status}.`,
      });
    }

    // Allow user to supply modified payload before finalizing, or fallback to staged payload
    const finalPayload = req.body.payload || pendingAction.payload;

    const savedRecords = {
      subjects: [],
      timetableSlots: [],
      holidays: [],
    };

    // 1. Process Subjects & Slots if present
    if (Array.isArray(finalPayload.subjects) && finalPayload.subjects.length > 0) {
      const subjectCodeMap = {};

      for (const sub of finalPayload.subjects) {
        let subject = await Subject.findOne({
          userId: req.userId,
          code: sub.code,
        });

        if (!subject) {
          subject = await Subject.create({
            userId: req.userId,
            name: sub.name,
            code: sub.code || '',
            faculty: sub.faculty || '',
            initialAttended: sub.initialAttended || 0,
            initialConducted: sub.initialConducted || 0,
          });
        }
        savedRecords.subjects.push(subject);

        if (sub.code) {
          subjectCodeMap[sub.code.trim().toUpperCase()] = subject._id;
        }
        if (sub.name) {
          subjectCodeMap[sub.name.trim().toUpperCase()] = subject._id;
        }
      }

      if (Array.isArray(finalPayload.timetableSlots)) {
        for (const slot of finalPayload.timetableSlots) {
          const subKey = (slot.subjectCode || slot.name || '').trim().toUpperCase();
          const targetSubjectId = subjectCodeMap[subKey] || savedRecords.subjects[0]?._id;

          if (targetSubjectId) {
            const newSlot = await TimetableSlot.create({
              userId: req.userId,
              subjectId: targetSubjectId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime || '',
              room: slot.room || '',
              weight: slot.weight || 1,
            });
            savedRecords.timetableSlots.push(newSlot);
          }
        }
      }
    }

    // 2. Process Holidays if present
    if (Array.isArray(finalPayload.holidays) && finalPayload.holidays.length > 0) {
      for (const h of finalPayload.holidays) {
        const newHoliday = await Holiday.create({
          userId: req.userId,
          name: h.name,
          date: h.date,
        });
        savedRecords.holidays.push(newHoliday);
      }
    }

    pendingAction.status = 'APPROVED';
    pendingAction.payload = finalPayload;
    await pendingAction.save();

    return res.json({
      status: 'APPROVED',
      pendingActionId: pendingAction._id,
      records: savedRecords,
    });
  } catch (error) {
    console.error('Error in /api/ingest/confirm:', error);
    return res.status(500).json({ error: 'Failed to confirm staged action.' });
  }
});

export default router;
