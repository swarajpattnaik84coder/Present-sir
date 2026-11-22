import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: '',
    },
    faculty: {
      type: String,
      trim: true,
      default: '',
    },
    initialAttended: {
      type: Number,
      default: 0,
      min: 0,
    },
    initialConducted: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Subject = mongoose.model('Subject', subjectSchema);
export default Subject;
