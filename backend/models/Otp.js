import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true }, // "phone:+911234567890" | "email:foo@bar.com"
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes the doc once expiresAt passes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', otpSchema);
export default Otp;
