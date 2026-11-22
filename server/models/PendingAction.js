import mongoose from 'mongoose';

const pendingActionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    agentType: {
      type: String,
      enum: ['TIMETABLE_INGEST', 'SELF_HEALING', 'CONDONATION', 'BATCH_CONSENSUS'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    summary: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const PendingAction = mongoose.model('PendingAction', pendingActionSchema);
export default PendingAction;
