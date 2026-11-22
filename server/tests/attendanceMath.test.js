import {
  calculatePercentage,
  maxSafeSkips,
  classesRequiredToReachTarget,
  getSubjectStats,
  simulateAbsenceRange,
  projectMaxPossibleAttendance,
} from '../services/attendanceMath.js';

describe('Deterministic Math Engine (attendanceMath.js)', () => {
  describe('calculatePercentage', () => {
    test('returns 0 when zero classes have been conducted', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
      expect(calculatePercentage(5, 0)).toBe(0);
    });

    test('calculates correct percentages rounded to 2 decimal places', () => {
      expect(calculatePercentage(24, 30)).toBe(80);
      expect(calculatePercentage(18, 25)).toBe(72);
      expect(calculatePercentage(15, 20)).toBe(75);
      expect(calculatePercentage(1, 3)).toBe(33.33);
      expect(calculatePercentage(2, 3)).toBe(66.67);
      expect(calculatePercentage(0, 10)).toBe(0);
      expect(calculatePercentage(10, 10)).toBe(100);
    });
  });

  describe('maxSafeSkips', () => {
    test('returns 0 when conducted is 0', () => {
      expect(maxSafeSkips(0, 0, 75)).toBe(0);
    });

    test('above target (24/30 at 75% target -> 80%, can skip 2)', () => {
      // 24/30 = 80%.
      // Skip 1 -> 24/31 = 77.42% (>= 75%)
      // Skip 2 -> 24/32 = 75.00% (>= 75%)
      // Skip 3 -> 24/33 = 72.73% (< 75%)
      expect(maxSafeSkips(24, 30, 75)).toBe(2);
    });

    test('below target (18/25 at 75% target -> 72%, returns 0)', () => {
      expect(maxSafeSkips(18, 25, 75)).toBe(0);
    });

    test('exactly at target (15/20 at 75% target -> returns 0)', () => {
      // 15/20 = 75%. Any skip drops it below 75% (15/21 = 71.43%)
      expect(maxSafeSkips(15, 20, 75)).toBe(0);
    });

    test('handles custom target percentages and edge inputs', () => {
      // 90/100 = 90% at 80% target: (100*90 - 80*100)/80 = 1000/80 = 12.5 -> floor = 12
      // 90 / (100 + 12) = 90/112 = 80.36% (>= 80%)
      // 90 / (100 + 13) = 90/113 = 79.65% (< 80%)
      expect(maxSafeSkips(90, 100, 80)).toBe(12);
      expect(maxSafeSkips(10, 10, 100)).toBe(0);
      expect(maxSafeSkips(10, 10, 105)).toBe(0);
    });
  });

  describe('classesRequiredToReachTarget', () => {
    test('returns 0 when conducted is 0', () => {
      expect(classesRequiredToReachTarget(0, 0, 75)).toBe(0);
    });

    test('below target (18/25 at 75% target -> 72%, needs 3 consecutive classes)', () => {
      // Current: 18/25 (72%)
      // +1 -> 19/26 = 73.08%
      // +2 -> 20/27 = 74.07%
      // +3 -> 21/28 = 75.00%
      expect(classesRequiredToReachTarget(18, 25, 75)).toBe(3);
    });

    test('above target returns 0', () => {
      expect(classesRequiredToReachTarget(24, 30, 75)).toBe(0);
    });

    test('exactly at target (15/20 at 75% target) returns 0', () => {
      expect(classesRequiredToReachTarget(15, 20, 75)).toBe(0);
    });

    test('safely handles 100% target requirement', () => {
      // If already missed a class (9/10), 100% is impossible -> returns null
      expect(classesRequiredToReachTarget(9, 10, 100)).toBeNull();

      // If already at 100% (10/10) -> returns 0
      expect(classesRequiredToReachTarget(10, 10, 100)).toBe(0);
    });
  });

  describe('getSubjectStats (Mid-semester baseline + tracked)', () => {
    test('returns NO_CLASSES when conducted is 0', () => {
      const stats = getSubjectStats({
        initialAttended: 0,
        initialConducted: 0,
        trackedAttended: 0,
        trackedConducted: 0,
      });
      expect(stats).toEqual({
        attended: 0,
        conducted: 0,
        percentage: 0,
        maxSafeSkips: 0,
        classesRequired: 0,
        status: 'NO_CLASSES',
      });
    });

    test('combines mid-semester baseline with tracked classes accurately', () => {
      // Baseline: 16/20 attended. Tracked since onboarding: 8/10 attended.
      // Total: 24/30 attended = 80% (SAFE)
      const stats = getSubjectStats(
        {
          initialAttended: 16,
          initialConducted: 20,
          trackedAttended: 8,
          trackedConducted: 10,
        },
        75
      );

      expect(stats).toEqual({
        attended: 24,
        conducted: 30,
        percentage: 80,
        maxSafeSkips: 2,
        classesRequired: 0,
        status: 'SAFE',
      });
    });

    test('returns ON_TARGET status when exactly at target', () => {
      const stats = getSubjectStats(
        {
          initialAttended: 15,
          initialConducted: 20,
        },
        75
      );
      expect(stats.status).toBe('ON_TARGET');
      expect(stats.percentage).toBe(75);
      expect(stats.maxSafeSkips).toBe(0);
      expect(stats.classesRequired).toBe(0);
    });

    test('returns DANGER status when below target', () => {
      const stats = getSubjectStats(
        {
          initialAttended: 18,
          initialConducted: 25,
        },
        75
      );
      expect(stats.status).toBe('DANGER');
      expect(stats.percentage).toBe(72);
      expect(stats.classesRequired).toBe(3);
      expect(stats.maxSafeSkips).toBe(0);
    });
  });

  describe('simulateAbsenceRange', () => {
    // Mon: Nov 24, 2026. Tue: Nov 25, 2026. Wed: Nov 26, 2026.
    const timetable = {
      monday: [
        { subjectId: 'MATH101', weight: 1 },
        { subjectId: 'CS102_LAB', weight: 2 }, // 2-hour lab slot
      ],
      tuesday: [
        { subjectId: 'MATH101', weight: 1 },
        { subjectId: 'PHY103', weight: 1 },
      ],
      wednesday: [
        { subjectId: 'MATH101', weight: 1 },
      ],
    };

    const subjects = [
      {
        id: 'MATH101',
        name: 'Mathematics',
        attended: 24,
        conducted: 30, // 80%, safe to skip 2
      },
      {
        id: 'CS102_LAB',
        name: 'CS Lab',
        attended: 16,
        conducted: 20, // 80%, safe to skip 1 weight: 2? Let's verify
      },
    ];

    test('skips holidays and applies weight: 2 lab slot correctly', () => {
      // Absence range: 2026-11-23 (Mon) to 2026-11-25 (Wed)
      // 2026-11-23 is Monday -> MATH101 (1), CS102_LAB (weight 2)
      // 2026-11-24 is Tuesday -> HOLIDAY (should be completely excluded!)
      // 2026-11-25 is Wednesday -> MATH101 (1)
      const simulation = simulateAbsenceRange({
        subjects,
        timetable,
        holidays: ['2026-11-24'], // Tuesday is a declared holiday
        startDate: '2026-11-23',
        endDate: '2026-11-25',
        targetPercent: 75,
      });

      // MATH101: Scheduled on Mon (1) and Wed (1) = 2 missed classes. (Tue skipped because of holiday)
      // Before: 24/30 (80%) -> After: 24/32 (75%) -> ON_TARGET, safeToSkip = true.
      const mathResult = simulation.results.find((r) => r.subjectId === 'MATH101');
      expect(mathResult).toBeDefined();
      expect(mathResult.missedClasses).toBe(2);
      expect(mathResult.before.percentage).toBe(80);
      expect(mathResult.after.conducted).toBe(32);
      expect(mathResult.after.percentage).toBe(75);
      expect(mathResult.after.status).toBe('ON_TARGET');
      expect(mathResult.safeToSkip).toBe(true);

      // CS102_LAB: Scheduled on Mon with weight: 2 -> 2 missed classes
      // Before: 16/20 (80%) -> After: 16/22 (72.73%) -> DANGER, safeToSkip = false.
      const labResult = simulation.results.find((r) => r.subjectId === 'CS102_LAB');
      expect(labResult).toBeDefined();
      expect(labResult.missedClasses).toBe(2);
      expect(labResult.before.percentage).toBe(80);
      expect(labResult.after.conducted).toBe(22);
      expect(labResult.after.percentage).toBe(72.73);
      expect(labResult.after.status).toBe('DANGER');
      expect(labResult.safeToSkip).toBe(false);

      // Overall safeToSkip must be false because CS102_LAB drops below 75%
      expect(simulation.safeToSkip).toBe(false);
    });

    test('returns safeToSkip: true when all subjects remain above target', () => {
      // Simulate only Wednesday (2026-11-25) where only MATH101 is scheduled (1 class)
      const simulation = simulateAbsenceRange({
        subjects,
        timetable,
        holidays: [],
        startDate: '2026-11-25',
        endDate: '2026-11-25',
        targetPercent: 75,
      });

      // MATH101: 24/31 = 77.42% (SAFE)
      // CS102_LAB: 0 missed classes -> 16/20 = 80% (SAFE)
      expect(simulation.safeToSkip).toBe(true);
      const mathResult = simulation.results.find((r) => r.subjectId === 'MATH101');
      expect(mathResult.missedClasses).toBe(1);
      expect(mathResult.after.status).toBe('SAFE');
    });
  });

  describe('projectMaxPossibleAttendance (Detention Shield)', () => {
    test('projects maximum possible percentage assuming 100% attendance of remaining classes', () => {
      // Current: 10/20 (50%). Remaining classes: 20.
      // Max possible: (10 + 20) / (20 + 20) = 30 / 40 = 75%
      expect(projectMaxPossibleAttendance(10, 20, 20)).toBe(75);
    });

    test('returns 100% if all remaining classes are attended from a clean start', () => {
      expect(projectMaxPossibleAttendance(0, 0, 30)).toBe(100);
    });

    test('handles detention barrier edge case where 75% is mathematically unachievable', () => {
      // Current: 5/25 (20%). Remaining classes: 15.
      // Max possible: (5 + 15) / (25 + 15) = 20 / 40 = 50% (< 75% detention threshold)
      expect(projectMaxPossibleAttendance(5, 25, 15)).toBe(50);
    });

    test('returns current percentage if remaining classes is 0', () => {
      expect(projectMaxPossibleAttendance(18, 24, 0)).toBe(75);
    });

    test('returns 0 when conducted and remaining classes are both 0', () => {
      expect(projectMaxPossibleAttendance(0, 0, 0)).toBe(0);
    });
  });
});
