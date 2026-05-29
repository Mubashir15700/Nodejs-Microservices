import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskRequest extends Document {
  taskId: mongoose.Types.ObjectId;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const TaskRequestSchema = new Schema<ITaskRequest>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task', // same service
      required: true,
    },
    requestedBy: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests
TaskRequestSchema.index({ taskId: 1, requestedBy: 1 }, { unique: true });

// Optimize queries
TaskRequestSchema.index({ requestedBy: 1 });
TaskRequestSchema.index({ taskId: 1 });

const TaskRequest = mongoose.model<ITaskRequest>('TaskRequest', TaskRequestSchema);

export default TaskRequest;
