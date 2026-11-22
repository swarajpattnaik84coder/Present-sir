/**
 * Deterministic Math Engine for Attendance Intelligence
 * Pure functions only - No DB calls, No AI calls
 */

/**
 * Calculates attendance percentage rounded to 2 decimal places.
 * If conducted === 0, returns 0.
 *
 * @param {number} attended - Number of classes attended
 * @param {number} conducted - Total number of classes conducted
 * @returns {number} Attendance percentage (0 - 100)
 */
export function calculatePercentage(attended, conducted) {
  if (!conducted || conducted <= 0) {
    return 0;
  }
  if (attended < 0) {
    return 0;
  }
  const raw = (attended / conducted) * 100;
  return Math.round(raw * 100) / 100;
}

/**
 * Returns the maximum integer number of consecutive classes that can be missed
 * while maintaining an attendance percentage at or above targetPercent.
 * Returns 0 if already below target or conducted === 0.
 *
 * @param {number} attended - Number of classes attended
 * @param {number} conducted - Total number of classes conducted
 * @param {number} [targetPercent=75] - Minimum required attendance percentage
 * @returns {number} Non-negative integer number of safe skips
 */
export function maxSafeSkips(attended, conducted, targetPercent = 75) {
  if (!conducted || conducted <= 0 || targetPercent <= 0) {
    return 0;
  }
  if (targetPercent > 100) {
    return 0;
  }

  const currentPercent = calculatePercentage(attended, conducted);
  if (currentPercent < targetPercent) {
    return 0;
  }

  // Formula: attended / (conducted + skips) >= targetPercent / 100
  // skips <= (100 * attended - targetPercent * conducted) / targetPercent
  const skips = Math.floor(((100 * attended - targetPercent * conducted) + 1e-9) / targetPercent);
  return Math.max(0, skips);
}

/**
 * Returns the integer number of consecutive classes that must be attended
 * to bring attendance up to at least targetPercent.
 * Returns 0 if already at or above target or conducted === 0.
 * Returns null if targetPercent === 100 and at least one class has been missed (mathematically impossible).
 *
 * @param {number} attended - Number of classes attended
 * @param {number} conducted - Total number of classes conducted
 * @param {number} [targetPercent=75] - Minimum required attendance percentage
 * @returns {number|null} Required classes, 0 if already safe, or null if impossible
 */
export function classesRequiredToReachTarget(attended, conducted, targetPercent = 75) {
  if (!conducted || conducted <= 0) {
    return 0;
  }
  if (targetPercent > 100) {
    return null;
  }
  if (targetPercent <= 0) {
    return 0;
  }

  const currentPercent = calculatePercentage(attended, conducted);
  if (currentPercent >= targetPercent) {
    return 0;
  }

  // Special safety check for 100% target:
  // If any class has been missed (attended < conducted), 100% is mathematically unachievable
  if (targetPercent === 100) {
    return attended < conducted ? null : 0;
  }

  // Formula: (attended + r) / (conducted + r) >= targetPercent / 100
  // r >= (targetPercent * conducted - 100 * attended) / (100 - targetPercent)
  const numerator = targetPercent * conducted - 100 * attended;
  const denominator = 100 - targetPercent;
  const required = Math.ceil((numerator - 1e-9) / denominator);

  return Math.max(0, required);
}

/**
 * Combines initial mid-semester baseline with tracked counts and returns
 * overall attendance stats and status.
 *
 * Status values:
 * - "NO_CLASSES": conducted === 0
 * - "SAFE": percentage > targetPercent
 * - "ON_TARGET": percentage === targetPercent
 * - "DANGER": percentage < targetPercent
 *
 * @param {Object} baseline - Initial baseline and tracked counts
 * @param {number} [baseline.initialAttended=0]
 * @param {number} [baseline.initialConducted=0]
 * @param {number} [baseline.trackedAttended=0]
 * @param {number} [baseline.trackedConducted=0]
 * @param {number} [targetPercent=75] - Minimum target percentage
 * @returns {Object} { attended, conducted, percentage, maxSafeSkips, classesRequired, status }
 */
export function getSubjectStats(
  { initialAttended = 0, initialConducted = 0, trackedAttended = 0, trackedConducted = 0 } = {},
  targetPercent = 75
) {
  const attended = initialAttended + trackedAttended;
  const conducted = initialConducted + trackedConducted;
  const percentage = calculatePercentage(attended, conducted);
  const safeSkips = maxSafeSkips(attended, conducted, targetPercent);
  const classesReq = classesRequiredToReachTarget(attended, conducted, targetPercent);

  let status = 'NO_CLASSES';
  if (conducted > 0) {
    if (percentage > targetPercent) {
      status = 'SAFE';
    } else if (percentage === targetPercent) {
      status = 'ON_TARGET';
    } else {
      status = 'DANGER';
    }
  }

  return {
    attended,
    conducted,
    percentage,
    maxSafeSkips: safeSkips,
    classesRequired: classesReq,
    status,
  };
}

/**
 * Helper to normalize any date input (Date object, timestamp, or YYYY-MM-DD string)
 * to a standardized local Date object at midnight.
 */
function normalizeDate(d) {
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof d === 'string') {
    const cleanStr = d.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  }
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Format a Date to YYYY-MM-DD string
 */
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Resolves timetable slots scheduled for a given Date.
 * Supports timetable structured as:
 * - Object with day names/indexes as keys: { monday: [...], tuesday: [...] }
 * - Array of day definitions: [ { day: 'monday', slots: [...] } ]
 * - Flat array of slots: [ { day: 'monday', subjectId: '...', weight: 2 } ]
 */
function getSlotsForDate(timetable, date) {
  if (!timetable) return [];

  const dayIndex = date.getDay();
  const dayName = DAY_NAMES[dayIndex];

  // 1. Timetable as an Object with day keys
  if (!Array.isArray(timetable) && typeof timetable === 'object') {
    const slots =
      timetable[dayName] ||
      timetable[dayName.charAt(0).toUpperCase() + dayName.slice(1)] ||
      timetable[dayName.toUpperCase()] ||
      timetable[dayIndex];

    if (Array.isArray(slots)) {
      return slots;
    }
    return [];
  }

  // 2. Timetable as an Array
  if (Array.isArray(timetable)) {
    const matchingSlots = [];
    for (const item of timetable) {
      if (!item) continue;

      const itemDay =
        typeof item.day === 'string'
          ? item.day.toLowerCase()
          : typeof item.dayOfWeek === 'number'
          ? DAY_NAMES[item.dayOfWeek]
          : typeof item.day === 'number'
          ? DAY_NAMES[item.day]
          : null;

      if (itemDay === dayName) {
        if (Array.isArray(item.slots)) {
          matchingSlots.push(...item.slots);
        } else {
          // Flat slot item
          matchingSlots.push(item);
        }
      }
    }
    return matchingSlots;
  }

  return [];
}

/**
 * Simulates the impact of missing all classes scheduled in a given date range.
 *
 * Counts scheduled classes between startDate and endDate (inclusive),
 * excluding any dates listed in holidays, respecting timetable slot weight (defaults to 1),
 * adds them to conducted (not attended), and returns before/after stats per subject plus a safeToSkip boolean.
 *
 * @param {Object} options
 * @param {Array|Object} options.subjects - List or map of subjects with current attendance
 * @param {Object|Array} options.timetable - Weekly timetable configuration
 * @param {Array} [options.holidays=[]] - Array of holiday dates (Date objects or strings)
 * @param {Date|string} options.startDate - Start date of the planned absence
 * @param {Date|string} options.endDate - End date of the planned absence
 * @param {number} [options.targetPercent=75] - Minimum required attendance percentage
 * @returns {Object} { safeToSkip: boolean, results: Array, subjects: Array }
 */
export function simulateAbsenceRange({
  subjects = [],
  timetable = {},
  holidays = [],
  startDate,
  endDate,
  targetPercent = 75,
}) {
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required for simulateAbsenceRange');
  }

  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  // Normalize holidays to Set of 'YYYY-MM-DD'
  const holidaySet = new Set();
  if (Array.isArray(holidays)) {
    for (const h of holidays) {
      if (!h) continue;
      const rawDate = typeof h === 'object' && h.date ? h.date : h;
      holidaySet.add(toDateString(normalizeDate(rawDate)));
    }
  }

  // Iterate day by day and accumulate scheduled missed weight per subject
  const missedCountBySubject = {};

  const current = new Date(start);
  while (current <= end) {
    const dateStr = toDateString(current);

    if (!holidaySet.has(dateStr)) {
      const slots = getSlotsForDate(timetable, current);
      for (const slot of slots) {
        const subId = slot.subjectId || slot.subject || slot.code || slot.id;
        if (subId) {
          const weight = typeof slot.weight === 'number' && slot.weight > 0 ? slot.weight : 1;
          missedCountBySubject[subId] = (missedCountBySubject[subId] || 0) + weight;
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Normalize subjects input to an array
  let subjectList = [];
  if (Array.isArray(subjects)) {
    subjectList = subjects;
  } else if (subjects && typeof subjects === 'object') {
    subjectList = Object.entries(subjects).map(([key, val]) => ({
      id: key,
      ...val,
    }));
  }

  let overallSafeToSkip = true;

  const results = subjectList.map((sub) => {
    const id = sub.id || sub.subjectId || sub.code || sub._id || sub.name;
    const name = sub.name || sub.title || id;

    const baseAttended =
      (sub.initialAttended || 0) + (sub.trackedAttended || 0) + (sub.attended || 0);
    const baseConducted =
      (sub.initialConducted || 0) + (sub.trackedConducted || 0) + (sub.conducted || 0);

    // Look up missed classes for this subject using id, subjectId, code, or name
    const missedClasses =
      missedCountBySubject[id] ||
      missedCountBySubject[sub.subjectId] ||
      missedCountBySubject[sub.code] ||
      missedCountBySubject[sub.id] ||
      missedCountBySubject[name] ||
      0;

    const before = getSubjectStats(
      { initialAttended: baseAttended, initialConducted: baseConducted },
      targetPercent
    );

    const after = getSubjectStats(
      { initialAttended: baseAttended, initialConducted: baseConducted + missedClasses },
      targetPercent
    );

    const subjectSafeToSkip = after.status !== 'DANGER';
    if (!subjectSafeToSkip) {
      overallSafeToSkip = false;
    }

    return {
      subjectId: id,
      name,
      missedClasses,
      before,
      after,
      safeToSkip: subjectSafeToSkip,
    };
  });

  return {
    safeToSkip: overallSafeToSkip,
    results,
    subjects: results,
  };
}

/**
 * Returns the maximum possible semester-end attendance percentage assuming
 * 100% attendance across all remainingClasses (Detention Shield projection).
 *
 * @param {number} attended - Number of classes attended so far
 * @param {number} conducted - Number of classes conducted so far
 * @param {number} remainingClasses - Total classes remaining in the semester
 * @returns {number} Maximum possible percentage rounded to 2 decimal places
 */
export function projectMaxPossibleAttendance(attended, conducted, remainingClasses) {
  const safeRemaining = Math.max(0, remainingClasses || 0);
  const totalAttended = attended + safeRemaining;
  const totalConducted = conducted + safeRemaining;

  if (totalConducted <= 0) {
    return 0;
  }

  return calculatePercentage(totalAttended, totalConducted);
}
