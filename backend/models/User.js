import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Dual Authentication: at least one of phone or email required
    phone: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 25,
    },
    profilePic: {
      type: String,
      default: '',    // empty string = show grey silhouette placeholder
    },
    about: {
      type: String,
      default: 'Hey there! I am using WhatsApp.',
    },
    status: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    deletedChats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Ensure at least one of phone or email is present
userSchema.pre('validate', function (next) {
  if (!this.phone && !this.email) {
    this.invalidate('phone', 'At least one of phone or email is required.');
  }
  next();
});

// Omit empty/null values so MongoDB sparse unique index never collides on missing values
userSchema.pre('save', function (next) {
  if (!this.phone) {
    this.phone = undefined;
  }
  if (!this.email) {
    this.email = undefined;
  }
  next();
});

const User = mongoose.model('User', userSchema);

// Drop legacy strict phone_1 index so MongoDB rebuilds it with sparse: true
User.collection.dropIndex('phone_1').catch(() => {});
User.collection.dropIndex('email_1').catch(() => {});

export default User;
