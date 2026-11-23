import express from 'express';
import Subject from '../models/Subject.js';
import TimetableSlot from '../models/TimetableSlot.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { getSubjectStats } from '../services/attendanceMath.js';

const router = express.Router();
router.use(requireAuth);

/**
 * Helper to compute tracked counts and stats for a single subject
 */
const computeSubjectStats = async (userId, subject, targetPercent = 75) => {
  const sessions = await AttendanceSession.find({ userId, subjectId: subject._id });

  let trackedAttended = 0;
  let trackedConducted = 0;

  for (const session of sessions) {
    if (session.status === 'PRESENT' || session.status === 'CONDONED') {
      trackedAttended += 1;
    }
    if (['PRESENT', 'CONDONED', 'ABSENT', 'PENDING_CONDONATION'].includes(session.status)) {
      trackedConducted += 1;
    }
  }

  const mathStats = getSubjectStats(
    {
      initialAttended: subject.initialAttended || 0,
      initialConducted: subject.initialConducted || 0,
      trackedAttended,
      trackedConducted,
    },
    targetPercent
  );

  return {
    ...subject.toObject ? subject.toObject() : subject,
    trackedAttended,
    trackedConducted,
    ...mathStats,
  };
};

/**
 * GET /api/attendance/dashboard
 * Fetches the logged-in user's subjects with combined deterministic stats.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const targetPercent = user?.targetPercent || 75;

    const subjects = await Subject.find({ userId: req.userId });
    const allSessions = await AttendanceSession.find({ userId: req.userId });

    // Group sessions by subjectId
    const sessionsBySubject = {};
    for (const s of allSessions) {
      const subId = s.subjectId.toString();
      if (!sessionsBySubject[subId]) {
        sessionsBySubject[subId] = [];
      }
      sessionsBySubject[subId].push(s);
    }

    const calculatedSubjects = subjects.map((sub) => {
      const subSessions = sessionsBySubject[sub._id.toString()] || [];
      let trackedAttended = 0;
      let trackedConducted = 0;

      for (const session of subSessions) {
        if (session.status === 'PRESENT' || session.status === 'CONDONED') {
          trackedAttended += 1;
        }
        if (['PRESENT', 'CONDONED', 'ABSENT', 'PENDING_CONDONATION'].includes(session.status)) {
          trackedConducted += 1;
        }
      }

      const mathStats = getSubjectStats(
        {
          initialAttended: sub.initialAttended || 0,
          initialConducted: sub.initialConducted || 0,
          trackedAttended,
          trackedConducted,
        },
        targetPercent
      );

      return {
        ...sub.toObject(),
        trackedAttended,
        trackedConducted,
        ...mathStats,
      };
    });

    return res.json({
      targetPercent,
      subjects: calculatedSubjects,
    });
  } catch (error) {
    console.error('Error in /api/attendance/dashboard:', error);
    return res.status(500).json({ error: 'Failed to load attendance dashboard.' });
  }
});

/**
 * GET /api/attendance/today
 * Accepts optional ?date=YYYY-MM-DD (defaults to today).
 * Checks holiday status, fetches day slots, and merges existing session marks.
 */
router.get('/today', async (req, res) => {
  try {
    let dateStr = req.query.date;

    let dayOfWeek;
    if (dateStr) {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      dayOfWeek = d.getDay();
    } else {
      const now = new Date();
      dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      dayOfWeek = now.getDay();
    }

    // Check if the date is an official Holiday
    const holiday = await Holiday.findOne({ userId: req.userId, date: dateStr });
    const isHoliday = !!holiday;
    const holidayName = holiday ? holiday.name : null;

    // Fetch scheduled slots for this day of week
    const slots = await TimetableSlot.find({ userId: req.userId, dayOfWeek })
      .populate('subjectId')
      .sort({ startTime: 1 });

    // Fetch any recorded sessions for this date
    const sessions = await AttendanceSession.find({ userId: req.userId, date: dateStr });

    const classes = slots.map((slot) => {
      const matchingSession = sessions.find(
        (s) =>
          (s.slotId && s.slotId.toString() === slot._id.toString()) ||
          (!s.slotId && s.subjectId.toString() === slot.subjectId?._id?.toString())
      );

      return {
        slotId: slot._id,
        subject: slot.subjectId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        weight: slot.weight || 1,
        status: matchingSession ? matchingSession.status : null,
        sessionId: matchingSession ? matchingSession._id : null,
      };
    });

    return res.json({
      date: dateStr,
      isHoliday,
      holidayName,
      classes,
    });
  } catch (error) {
    console.error('Error in /api/attendance/today:', error);
    return res.status(500).json({ error: 'Failed to fetch schedule for the day.' });
  }
});

/**
 * POST /api/attendance/mark
 * Accepts { subjectId, date, slotId, status } ("PRESENT", "ABSENT", or "CANCELLED")
 * Upserts the AttendanceSession and returns the updated session plus recalculated subject stats.
 */
router.post('/mark', async (req, res) => {
  try {
    const { subjectId, date, slotId, status } = req.body;

    if (!subjectId || !date || !status) {
      return res.status(400).json({
        error: 'subjectId, date, and status are required.',
      });
    }

    const allowedStatuses = ['PRESENT', 'ABSENT', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const subject = await Subject.findOne({ _id: subjectId, userId: req.userId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const session = await AttendanceSession.findOneAndUpdate(
      {
        userId: req.userId,
        subjectId,
        date,
        slotId: slotId || null,
      },
      { status },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const user = await User.findById(req.userId);
    const updatedSubjectStats = await computeSubjectStats(
      req.userId,
      subject,
      user?.targetPercent || 75
    );

    return res.json({
      session,
      subject: updatedSubjectStats,
    });
  } catch (error) {
    console.error('Error in /api/attendance/mark:', error);
    return res.status(500).json({ error: 'Failed to mark attendance.' });
  }
});

/**
 * PUT /api/attendance/baseline/:subjectId
 * Updates initialAttended and initialConducted for mid-semester onboarding/sync.
 */
router.put('/baseline/:subjectId', async (req, res) => {
  try {
    const { initialAttended, initialConducted } = req.body;

    if (initialAttended === undefined || initialConducted === undefined) {
      return res.status(400).json({
        error: 'initialAttended and initialConducted are required.',
      });
    }

    const attendedNum = Number(initialAttended);
    const conductedNum = Number(initialConducted);

    if (isNaN(attendedNum) || isNaN(conductedNum) || attendedNum < 0 || conductedNum < 0) {
      return res.status(400).json({
        error: 'initialAttended and initialConducted must be non-negative numbers.',
      });
    }

    if (attendedNum > conductedNum) {
      return res.status(400).json({
        error: 'initialAttended cannot be greater than initialConducted.',
      });
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.subjectId, userId: req.userId },
      { initialAttended: attendedNum, initialConducted: conductedNum },
      { new: true }
    );

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const user = await User.findById(req.userId);
    const updatedSubjectStats = await computeSubjectStats(
      req.userId,
      subject,
      user?.targetPercent || 75
    );

    return res.json({
      subject: updatedSubjectStats,
    });
  } catch (error) {
    console.error('Error in /api/attendance/baseline:', error);
    return res.status(500).json({ error: 'Failed to update subject baseline.' });
  }
});

export default router;
