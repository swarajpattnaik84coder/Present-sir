import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import TimetableSlot from '../models/TimetableSlot.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Holiday from '../models/Holiday.js';
import PendingAction from '../models/PendingAction.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getSubjectStats,
  projectMaxPossibleAttendance,
  simulateAbsenceRange,
} from '../services/attendanceMath.js';
import {
  generateText,
  generateStructuredJSON,
  isQuotaOrUnavailableError,
} from '../services/llmClient.js';

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const formatLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDate = (dateStr) => {
  if (dateStr instanceof Date) {
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  }
  const clean = String(dateStr).split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getTrackedCounts = (sessions = []) => {
  let trackedAttended = 0;
  let trackedConducted = 0;
  for (const s of sessions) {
    if (s.status === 'PRESENT' || s.status === 'CONDONED') {
      trackedAttended += 1;
    }
    if (['PRESENT', 'CONDONED', 'ABSENT', 'PENDING_CONDONATION'].includes(s.status)) {
      trackedConducted += 1;
    }
  }
  return { trackedAttended, trackedConducted };
};

/**
 * GET /api/agents/detention-shield
 * 100% deterministic projection of maximum achievable semester-end attendance.
 */
router.get('/detention-shield', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetPercent = user.targetPercent || 75;
    const [subjects, slots, sessions, holidays] = await Promise.all([
      Subject.find({ userId: req.userId }),
      TimetableSlot.find({ userId: req.userId }),
      AttendanceSession.find({ userId: req.userId }),
      Holiday.find({ userId: req.userId }),
    ]);

    const holidaySet = new Set(holidays.map((h) => h.date));
    const sessionsBySubject = {};
    for (const s of sessions) {
      const id = s.subjectId.toString();
      if (!sessionsBySubject[id]) sessionsBySubject[id] = [];
      sessionsBySubject[id].push(s);
    }

    // Count remaining scheduled classes from tomorrow until semesterEndDate (inclusive)
    const remainingBySubject = {};
    if (user.semesterEndDate) {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const endDate = parseLocalDate(user.semesterEndDate);

      if (tomorrow <= endDate) {
        const slotsByDay = {};
        for (const slot of slots) {
          if (!slotsByDay[slot.dayOfWeek]) slotsByDay[slot.dayOfWeek] = [];
          slotsByDay[slot.dayOfWeek].push(slot);
        }

        const cursor = new Date(tomorrow);
        while (cursor <= endDate) {
          const dateStr = formatLocalDate(cursor);
          if (!holidaySet.has(dateStr)) {
            const daySlots = slotsByDay[cursor.getDay()] || [];
            for (const slot of daySlots) {
              const subId = slot.subjectId.toString();
              const weight = typeof slot.weight === 'number' && slot.weight > 0 ? slot.weight : 1;
              remainingBySubject[subId] = (remainingBySubject[subId] || 0) + weight;
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    const results = subjects.map((sub) => {
      const subId = sub._id.toString();
      const { trackedAttended, trackedConducted } = getTrackedCounts(sessionsBySubject[subId]);
      const stats = getSubjectStats(
        {
          initialAttended: sub.initialAttended || 0,
          initialConducted: sub.initialConducted || 0,
          trackedAttended,
          trackedConducted,
        },
        targetPercent
      );

      const remainingClasses = remainingBySubject[subId] || 0;
      const maxPossiblePercent = projectMaxPossibleAttendance(
        stats.attended,
        stats.conducted,
        remainingClasses
      );

      let riskLevel = 'SAFE';
      if (maxPossiblePercent < targetPercent) {
        riskLevel = 'DETENTION_RISK';
      } else if (stats.percentage < targetPercent) {
        riskLevel = 'WARNING';
      }

      return {
        subjectId: sub._id,
        name: sub.name,
        code: sub.code,
        currentPercent: stats.percentage,
        remainingClasses,
        maxPossiblePercent,
        riskLevel,
      };
    });

    return res.json({
      targetPercent,
      semesterEndDate: user.semesterEndDate,
      subjects: results,
    });
  } catch (error) {
    console.error('Error in /api/agents/detention-shield:', error);
    return res.status(500).json({ error: 'Failed to calculate Detention Shield projections.' });
  }
});

/**
 * POST /api/agents/trip-strategist
 * Deterministic absence simulation + Gemini strategic advice (with deterministic fallback).
 */
router.post('/trip-strategist', async (req, res) => {
  try {
    const { startDate, endDate, note = '' } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate (YYYY-MM-DD) are required.' });
    }

    const user = await User.findById(req.userId);
    const targetPercent = user?.targetPercent || 75;

    const [subjects, slots, sessions, holidays] = await Promise.all([
      Subject.find({ userId: req.userId }),
      TimetableSlot.find({ userId: req.userId }),
      AttendanceSession.find({ userId: req.userId }),
      Holiday.find({ userId: req.userId }),
    ]);

    const sessionsBySubject = {};
    for (const s of sessions) {
      const id = s.subjectId.toString();
      if (!sessionsBySubject[id]) sessionsBySubject[id] = [];
      sessionsBySubject[id].push(s);
    }

    const mathSubjects = subjects.map((sub) => {
      const { trackedAttended, trackedConducted } = getTrackedCounts(
        sessionsBySubject[sub._id.toString()]
      );
      return {
        id: sub._id.toString(),
        name: sub.name,
        code: sub.code,
        initialAttended: sub.initialAttended || 0,
        initialConducted: sub.initialConducted || 0,
        trackedAttended,
        trackedConducted,
      };
    });

    const timetable = slots.map((slot) => ({
      day: slot.dayOfWeek,
      subjectId: slot.subjectId.toString(),
      weight: slot.weight || 1,
    }));

    const simulation = simulateAbsenceRange({
      subjects: mathSubjects,
      timetable,
      holidays: holidays.map((h) => h.date),
      startDate,
      endDate,
      targetPercent,
    });

    const atRiskSubjects = simulation.results.filter((r) => !r.safeToSkip);
    const deterministicSummary = simulation.safeToSkip
      ? `Safe to take leave from ${startDate} to ${endDate}. All ${simulation.results.length} subjects remain at or above your ${targetPercent}% target.`
      : `Caution: Taking leave from ${startDate} to ${endDate} will push ${atRiskSubjects
          .map((r) => `${r.name} (${r.after.percentage}%)`)
          .join(', ')} below your ${targetPercent}% target.`;

    let advice = deterministicSummary;
    let usedFallback = false;

    const prompt = `You are a concise academic attendance advisor for a college student.
The student wants to miss classes from ${startDate} to ${endDate}${note ? ` (Note: "${note}")` : ''}.
Target attendance: ${targetPercent}%.
Overall safeToSkip: ${simulation.safeToSkip}.

Exact simulation per subject:
${simulation.results
  .map(
    (r) =>
      `- ${r.name}: misses ${r.missedClasses} class(es), drops from ${r.before.percentage}% to ${r.after.percentage}% (status: ${r.after.status}, classesNeededIfDropped: ${r.after.classesRequired ?? 'N/A'})`
  )
  .join('\n')}

Write 2-3 crisp, student-friendly sentences advising whether they can take this leave and which subjects need attention. Do NOT recalculate or alter any numbers.`;

    try {
      const aiAdvice = await generateText(prompt);
      if (aiAdvice) {
        advice = aiAdvice;
      }
    } catch (err) {
      if (isQuotaOrUnavailableError(err)) {
        console.warn('⚠️ Trip Strategist falling back to deterministic advice:', err.message);
        usedFallback = true;
      } else {
        throw err;
      }
    }

    return res.json({
      safeToSkip: simulation.safeToSkip,
      simulation,
      advice,
      usedFallback,
    });
  } catch (error) {
    console.error('Error in /api/agents/trip-strategist:', error);
    return res.status(500).json({ error: 'Failed to run trip simulation.' });
  }
});

/**
 * POST /api/agents/condonation
 * Stages a HITL PendingAction for medical or on-duty condonation.
 */
router.post('/condonation', upload.single('file'), async (req, res) => {
  try {
    let { startDate, endDate, reason, type = 'MEDICAL' } = req.body || {};

    if (req.file && (!startDate || !endDate)) {
      const schema = {
        type: 'OBJECT',
        properties: {
          startDate: { type: 'STRING' },
          endDate: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['startDate', 'endDate', 'reason'],
      };

      const prompt = `Extract the leave/condonation startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), and brief reason from this medical certificate or on-duty letter. If only a single date is present, set both startDate and endDate to that date.`;

      const extracted = await generateStructuredJSON(prompt, schema, [req.file]);
      startDate = startDate || extracted.startDate;
      endDate = endDate || extracted.endDate;
      reason = reason || extracted.reason;
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate (YYYY-MM-DD) are required, or upload a document containing them.',
      });
    }

    const condonationType = type === 'ON_DUTY' ? 'ON_DUTY' : 'MEDICAL';

    const absentSessions = await AttendanceSession.find({
      userId: req.userId,
      status: 'ABSENT',
      date: { $gte: startDate, $lte: endDate },
    });

    const affectedSessionIds = absentSessions.map((s) => s._id);
    const summary = `${condonationType} condonation (${startDate} to ${endDate}): ${affectedSessionIds.length} absent session(s) staged for approval${reason ? ` — ${reason}` : ''}.`;

    const pendingAction = await PendingAction.create({
      userId: req.userId,
      agentType: 'CONDONATION',
      status: 'PENDING_APPROVAL',
      payload: {
        startDate,
        endDate,
        reason: reason || '',
        type: condonationType,
        affectedSessionIds,
      },
      summary,
    });

    return res.status(202).json({
      pendingActionId: pendingAction._id,
      status: 'PENDING_APPROVAL',
      summary,
      affectedCount: affectedSessionIds.length,
    });
  } catch (error) {
    console.error('Error in /api/agents/condonation:', error);
    return res.status(500).json({ error: error.message || 'Failed to stage condonation request.' });
  }
});

/**
 * POST /api/agents/batch-consensus/report
 * Checks cohort consensus for a cancelled slot and stages PendingActions for classmates.
 */
router.post('/batch-consensus/report', async (req, res) => {
  try {
    const {
      subjectCode,
      date,
      startTime,
      reportedStatus = 'CANCELLED',
      forceConsensus = false,
    } = req.body;

    if (!subjectCode || !date || !startTime) {
      return res.status(400).json({
        error: 'subjectCode, date, and startTime are required.',
      });
    }

    const reporter = await User.findById(req.userId);
    if (!reporter) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const classmates = await User.find({
      _id: { $ne: req.userId },
      collegeId: reporter.collegeId,
      department: reporter.department,
      semester: reporter.semester,
      section: reporter.section,
    });

    const cohortIds = [req.userId, ...classmates.map((c) => c._id)];
    const codeRegex = new RegExp(`^${subjectCode.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const cohortSubjects = await Subject.find({
      userId: { $in: cohortIds },
      code: codeRegex,
    });

    const subjectByUser = {};
    for (const sub of cohortSubjects) {
      subjectByUser[sub.userId.toString()] = sub;
    }

    const dayOfWeek = parseLocalDate(date).getDay();
    const cohortSlots = await TimetableSlot.find({
      userId: { $in: cohortIds },
      subjectId: { $in: cohortSubjects.map((s) => s._id) },
      dayOfWeek,
      startTime,
    });

    const slotByUser = {};
    for (const sl of cohortSlots) {
      slotByUser[sl.userId.toString()] = sl;
    }

    const matchingSessions = await AttendanceSession.find({
      userId: { $in: cohortIds },
      subjectId: { $in: cohortSubjects.map((s) => s._id) },
      date,
      status: reportedStatus,
    });

    const reportedUserSet = new Set(matchingSessions.map((s) => s.userId.toString()));
    reportedUserSet.add(req.userId.toString());

    const consensusReached = forceConsensus === true || reportedUserSet.size >= 2;
    let alertsCreated = 0;

    if (consensusReached && classmates.length > 0) {
      const existingAlerts = await PendingAction.find({
        userId: { $in: classmates.map((c) => c._id) },
        agentType: 'BATCH_CONSENSUS',
        status: 'PENDING_APPROVAL',
        'payload.subjectCode': subjectCode.toUpperCase(),
        'payload.date': date,
        'payload.startTime': startTime,
      });

      const alreadyAlertedIds = new Set(existingAlerts.map((a) => a.userId.toString()));

      for (const mate of classmates) {
        const mateId = mate._id.toString();
        if (alreadyAlertedIds.has(mateId) || reportedUserSet.has(mateId)) {
          continue;
        }

        const mateSub = subjectByUser[mateId];
        const mateSlot = slotByUser[mateId];

        await PendingAction.create({
          userId: mate._id,
          agentType: 'BATCH_CONSENSUS',
          status: 'PENDING_APPROVAL',
          payload: {
            subjectCode: subjectCode.toUpperCase(),
            date,
            startTime,
            reportedStatus,
            subjectId: mateSub ? mateSub._id : null,
            slotId: mateSlot ? mateSlot._id : null,
          },
          summary: `Batch Consensus: ${subjectCode.toUpperCase()} (${startTime}) on ${date} was reported ${reportedStatus} by classmates.`,
        });
        alertsCreated += 1;
      }
    }

    return res.json({
      consensusReached,
      alertsCreated,
    });
  } catch (error) {
    console.error('Error in /api/agents/batch-consensus/report:', error);
    return res.status(500).json({ error: 'Failed to process batch consensus report.' });
  }
});

/**
 * GET /api/agents/pending
 * Returns all PENDING_APPROVAL actions for the logged-in user, newest first.
 */
router.get('/pending', async (req, res) => {
  try {
    const actions = await PendingAction.find({
      userId: req.userId,
      status: 'PENDING_APPROVAL',
    }).sort({ createdAt: -1 });

    return res.json({ actions });
  } catch (error) {
    console.error('Error in /api/agents/pending:', error);
    return res.status(500).json({ error: 'Failed to fetch pending actions.' });
  }
});

/**
 * POST /api/agents/pending/:id/resolve
 * Approves or rejects a staged PendingAction (HITL execution).
 */
router.post('/pending/:id/resolve', async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "APPROVE" or "REJECT".' });
    }

    const action = await PendingAction.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!action) {
      return res.status(404).json({ error: 'Pending action not found.' });
    }

    if (action.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: `Action already ${action.status}.` });
    }

    if (decision === 'REJECT') {
      action.status = 'REJECTED';
      await action.save();
      return res.json({ action });
    }

    // decision === 'APPROVE'
    const payload = action.payload || {};

    if (action.agentType === 'CONDONATION') {
      const ids = Array.isArray(payload.affectedSessionIds) ? payload.affectedSessionIds : [];
      if (ids.length > 0) {
        await AttendanceSession.updateMany(
          { _id: { $in: ids }, userId: req.userId },
          { $set: { status: 'CONDONED' } }
        );
      }
    } else if (action.agentType === 'BATCH_CONSENSUS') {
      let targetSubjectId = payload.subjectId;
      let targetSlotId = payload.slotId || null;

      if (!targetSubjectId && payload.subjectCode) {
        const codeRegex = new RegExp(
          `^${String(payload.subjectCode).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        );
        const sub = await Subject.findOne({ userId: req.userId, code: codeRegex });
        if (sub) {
          targetSubjectId = sub._id;
          if (!targetSlotId && payload.date && payload.startTime) {
            const dayOfWeek = parseLocalDate(payload.date).getDay();
            const slot = await TimetableSlot.findOne({
              userId: req.userId,
              subjectId: sub._id,
              dayOfWeek,
              startTime: payload.startTime,
            });
            if (slot) targetSlotId = slot._id;
          }
        }
      }

      if (targetSubjectId && payload.date) {
        await AttendanceSession.findOneAndUpdate(
          {
            userId: req.userId,
            subjectId: targetSubjectId,
            date: payload.date,
            slotId: targetSlotId,
          },
          { status: payload.reportedStatus || 'CANCELLED' },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    action.status = 'APPROVED';
    await action.save();

    return res.json({ action });
  } catch (error) {
    console.error('Error in /api/agents/pending/:id/resolve:', error);
    return res.status(500).json({ error: 'Failed to resolve pending action.' });
  }
});

export default router;
