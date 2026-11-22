import mongoose from 'mongoose';

const attendanceSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableSlot',
      default: null,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'CANCELLED', 'PENDING_CONDONATION', 'CONDONED'],
      required: true,
      default: 'PRESENT',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate entries for the same user, subject, date, and slot
attendanceSessionSchema.index(
  { userId: 1, subjectId: 1, date: 1, slotId: 1 },
  { unique: true }
);

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);
export default AttendanceSession;
