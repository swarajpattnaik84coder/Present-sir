import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'dns';

import User from './models/User.js';
import Subject from './models/Subject.js';
import TimetableSlot from './models/TimetableSlot.js';
import AttendanceSession from './models/AttendanceSession.js';
import Holiday from './models/Holiday.js';
import PendingAction from './models/PendingAction.js';

dotenv.config();

const connectWithFallback = async (uri) => {
  try {
    return await mongoose.connect(uri);
  } catch (err) {
    if (err.message && err.message.includes('querySrv ECONNREFUSED')) {
      console.warn('⚠️  SRV lookup failed on local DNS. Retrying with Google/Cloudflare DNS...');
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      return await mongoose.connect(uri);
    }
    throw err;
  }
};

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI is not set in environment variables.');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await connectWithFallback(mongoUri);
  console.log('✅ Connected to MongoDB.');

  const demoEmails = [
    'demo@presentsir.app',
    'mate1@presentsir.app',
    'mate2@presentsir.app',
    'mate3@presentsir.app',
  ];

  console.log('🧹 Clearing existing demo accounts and associated data...');
  const existingUsers = await User.find({ email: { $in: demoEmails } });
  const userIds = existingUsers.map((u) => u._id);

  if (userIds.length > 0) {
    await Promise.all([
      Subject.deleteMany({ userId: { $in: userIds } }),
      TimetableSlot.deleteMany({ userId: { $in: userIds } }),
      AttendanceSession.deleteMany({ userId: { $in: userIds } }),
      Holiday.deleteMany({ userId: { $in: userIds } }),
      PendingAction.deleteMany({ userId: { $in: userIds } }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    console.log(`Deleted existing data for ${userIds.length} demo user(s).`);
  }

  const defaultPassword = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  const sharedCohort = {
    collegeId: 'COL001',
    department: 'Computer Science',
    semester: 5,
    section: 'A',
    targetPercent: 75,
    semesterStartDate: new Date('2026-08-01'),
    semesterEndDate: new Date('2026-12-15'),
  };

  // 1. Create Demo User
  console.log('👤 Creating primary demo user...');
  const demoUser = await User.create({
    name: 'Swaraj Demo',
    email: 'demo@presentsir.app',
    passwordHash,
    ...sharedCohort,
  });

  // 2. Create 3 Classmates
  console.log('👥 Creating 3 cohort classmates...');
  const classmates = await User.create([
    {
      name: 'Aarav Sharma',
      email: 'mate1@presentsir.app',
      passwordHash,
      ...sharedCohort,
    },
    {
      name: 'Priya Patel',
      email: 'mate2@presentsir.app',
      passwordHash,
      ...sharedCohort,
    },
    {
      name: 'Rohan Verma',
      email: 'mate3@presentsir.app',
      passwordHash,
      ...sharedCohort,
    },
  ]);

  // 3. Seed 4 Subjects for the Demo User with realistic mid-semester baselines
  console.log('📚 Seeding 4 subjects for demo user...');
  const subjectsData = [
    {
      userId: demoUser._id,
      name: 'Data Structures & Algorithms',
      code: 'CS501',
      faculty: 'Dr. Arvind Rao',
      initialAttended: 24,
      initialConducted: 30, // 80.00% -> SAFE (2 safe skips)
    },
    {
      userId: demoUser._id,
      name: 'Discrete Mathematics',
      code: 'CS502',
      faculty: 'Prof. Meera Sen',
      initialAttended: 18,
      initialConducted: 25, // 72.00% -> DANGER (requires 3 consecutive classes)
    },
    {
      userId: demoUser._id,
      name: 'Database Management Systems',
      code: 'CS503',
      faculty: 'Dr. Rajesh Gupta',
      initialAttended: 35,
      initialConducted: 40, // 87.50% -> SAFE
    },
    {
      userId: demoUser._id,
      name: 'Operating Systems',
      code: 'CS504',
      faculty: 'Prof. Ananya Nair',
      initialAttended: 19,
      initialConducted: 25, // 76.00% -> Borderline SAFE (0 skips before falling below 75)
    },
  ];

  const createdSubjects = await Subject.create(subjectsData);
  const [dsa, math, dbms, os] = createdSubjects;

  // 4. Seed Weekly Timetable for Demo User (Mon-Fri)
  console.log('📅 Seeding weekly timetable slots...');
  const timetableSlots = [
    // Monday (1)
    {
      userId: demoUser._id,
      subjectId: dsa._id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-301',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: math._id,
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:00',
      room: 'LH-301',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: dbms._id,
      dayOfWeek: 1,
      startTime: '11:30',
      endTime: '13:30',
      room: 'CS-Lab-2',
      weight: 2, // 2-hour lab slot
    },

    // Tuesday (2)
    {
      userId: demoUser._id,
      subjectId: os._id,
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: dbms._id,
      dayOfWeek: 2,
      startTime: '10:00',
      endTime: '11:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: math._id,
      dayOfWeek: 2,
      startTime: '11:30',
      endTime: '12:30',
      room: 'LH-301',
      weight: 1,
    },

    // Wednesday (3)
    {
      userId: demoUser._id,
      subjectId: dsa._id,
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-301',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: os._id,
      dayOfWeek: 3,
      startTime: '10:00',
      endTime: '11:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: os._id,
      dayOfWeek: 3,
      startTime: '14:00',
      endTime: '16:00',
      room: 'CS-Lab-1',
      weight: 2, // 2-hour lab slot
    },

    // Thursday (4)
    {
      userId: demoUser._id,
      subjectId: math._id,
      dayOfWeek: 4,
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-301',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: dbms._id,
      dayOfWeek: 4,
      startTime: '10:00',
      endTime: '11:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: dsa._id,
      dayOfWeek: 4,
      startTime: '11:30',
      endTime: '12:30',
      room: 'LH-301',
      weight: 1,
    },

    // Friday (5)
    {
      userId: demoUser._id,
      subjectId: os._id,
      dayOfWeek: 5,
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: dbms._id,
      dayOfWeek: 5,
      startTime: '10:00',
      endTime: '11:00',
      room: 'LH-302',
      weight: 1,
    },
    {
      userId: demoUser._id,
      subjectId: math._id,
      dayOfWeek: 5,
      startTime: '11:30',
      endTime: '12:30',
      room: 'LH-301',
      weight: 1,
    },
  ];

  await TimetableSlot.create(timetableSlots);

  // 5. Seed 3 Upcoming Holidays
  console.log('🎉 Seeding 3 upcoming holidays...');
  const holidays = [
    {
      userId: demoUser._id,
      name: 'Constitution Day Observed',
      date: '2026-11-27',
    },
    {
      userId: demoUser._id,
      name: 'Annual College Sports Day',
      date: '2026-12-05',
    },
    {
      userId: demoUser._id,
      name: 'Christmas Vacation',
      date: '2026-12-25',
    },
  ];

  await Holiday.create(holidays);

  console.log('\n=========================================');
  console.log('✨ Demo Data Successfully Seeded! ✨');
  console.log('=========================================');
  console.log(`Demo User:     ${demoUser.email} (Password: ${defaultPassword})`);
  console.log(`Classmate 1:   ${classmates[0].email} (Password: ${defaultPassword})`);
  console.log(`Classmate 2:   ${classmates[1].email} (Password: ${defaultPassword})`);
  console.log(`Classmate 3:   ${classmates[2].email} (Password: ${defaultPassword})`);
  console.log(`Cohort:        ${sharedCohort.department}, Sem ${sharedCohort.semester}, Sec ${sharedCohort.section}`);
  console.log(`Subjects:      DSA (80%), Math (72%), DBMS (87.5%), OS (76%)`);
  console.log(`Timetable:     ${timetableSlots.length} weekly slots created`);
  console.log(`Holidays:      ${holidays.length} upcoming holidays created`);
  console.log('=========================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
