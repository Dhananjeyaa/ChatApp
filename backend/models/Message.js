import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    // Optional legacy/alias fields for indexed lookup compatibility
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    message: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'audio', 'image', 'file'],
      default: 'text',
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    mediaDuration: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // 3-way message deletion support:
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ─── High-Performance Compound Indexes ─────────────────────────────────────────
// Optimal for cursor pagination & reverse chronological queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });

// Optimal for 1-on-1 direct message lookups and deletions
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// Optimal for starred message lookups
messageSchema.index({ starredBy: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
