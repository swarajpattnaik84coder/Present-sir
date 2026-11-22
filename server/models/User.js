import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    collegeId: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: mongoose.Schema.Types.Mixed,
      default: 1,
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    targetPercent: {
      type: Number,
      default: 75,
      min: 1,
      max: 100,
    },
    semesterStartDate: {
      type: Date,
      default: null,
    },
    semesterEndDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);
export default User;
