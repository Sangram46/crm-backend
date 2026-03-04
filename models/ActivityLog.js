const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    action: {
      type: String,
      enum: {
        values: ['CREATE', 'UPDATE', 'DELETE'],
        message: 'Action must be CREATE, UPDATE, or DELETE',
      },
      required: [true, 'Action is required'],
    },
    entityType: {
      type: String,
      enum: ['Contact'],
      default: 'Contact',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    contactName: {
      type: String,
      required: [true, 'Contact name is required for activity log'],
    },
    details: {
      type: String,
      default: '',
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for efficient querying
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

// Apply pagination plugin
activityLogSchema.plugin(mongoosePaginate);

// Static method to log an activity
activityLogSchema.statics.logActivity = async function ({
  user,
  action,
  entityId,
  contactName,
  details,
  changes,
}) {
  return this.create({
    user,
    action,
    entityType: 'Contact',
    entityId,
    contactName,
    details,
    changes,
  });
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
