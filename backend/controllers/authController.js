import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import {
  generateOtp,
  hashOtp,
  compareOtp,
  sendOtpEmail,
  sendOtpSms,
  OTP_TTL_MS,
  MAX_OTP_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from '../utils/otpService.js';

// ─── JWT helper ────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ─── Normalizers ───────────────────────────────────────────────────────────
const normalizePhone = (phone) =>
  (phone || '').toString().trim().replace(/[\s()-]/g, '');

const normalizeEmail = (email) =>
  (email || '').toString().trim().toLowerCase();

// ─── Build safe user response object ───────────────────────────────────────
const userPayload = (user) => ({
  _id: user._id,
  phone: user.phone,
  email: user.email,
  name: user.name,
  profilePic: user.profilePic || '',
  about: user.about,
  status: user.status,
  lastSeen: user.lastSeen,
});

// ─── Shared OTP issue/verify helpers ────────────────────────────────────────
const issueOtp = async (identifier) => {
  const existing = await Otp.findOne({ identifier });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - existing.createdAt.getTime())) / 1000
    );
    const err = new Error(`Please wait ${waitSec}s before requesting a new code.`);
    err.code = 'COOLDOWN';
    throw err;
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await Otp.findOneAndUpdate(
    { identifier },
    { otpHash, expiresAt, attempts: 0 },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return otp; // caller sends it via email/SMS — never returned to the HTTP client
};

const consumeOtp = async (identifier, submittedOtp) => {
  const record = await Otp.findOne({ identifier });

  if (!record) return { ok: false, reason: 'No OTP found. Please request a new code.' };
  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    return { ok: false, reason: 'OTP expired. Please request a new code.' };
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    return { ok: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  const isMatch = await compareOtp(submittedOtp, record.otpHash);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    return { ok: false, reason: 'Invalid OTP code.' };
  }

  await Otp.deleteOne({ _id: record._id });
  return { ok: true };
};

// ════════════════════════════════════════════════════════════════════════════
// PHONE OTP
// ════════════════════════════════════════════════════════════════════════════

// @desc  Send OTP to phone
// @route POST /api/auth/send-phone-otp
export const sendPhoneOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || req.body.phoneNumber);

    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
    }

    const otp = await issueOtp(`phone:${phone}`);
    await sendOtpSms(phone, otp);

    // No `otp` field in the response — this is the actual fix for the bypass bug.
    return res.status(200).json({ success: true, message: 'OTP sent successfully.', phone });
  } catch (err) {
    const status = err.code === 'COOLDOWN' ? 429 : 500;
    console.error('sendPhoneOtp error:', err.message);
    return res.status(status).json({
      success: false,
      message: err.code === 'COOLDOWN' ? err.message : (err.message || 'Failed to send phone OTP.'),
    });
  }
};

// @desc  Verify phone OTP
// @route POST /api/auth/verify-phone-otp
export const verifyPhoneOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone || req.body.phoneNumber);
    const otp = (req.body.otp || '').toString().trim();

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const result = await consumeOtp(`phone:${phone}`, otp);
    if (!result.ok) return res.status(400).json({ success: false, message: result.reason });

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      existingUser.status = 'online';
      await existingUser.save();
      return res.status(200).json({
        success: true,
        isNewUser: false,
        token: generateToken(existingUser._id),
        user: userPayload(existingUser),
      });
    }

    return res.status(200).json({
      success: true,
      isNewUser: true,
      phone,
      message: 'OTP verified. Please complete your profile.',
    });
  } catch (err) {
    console.error('verifyPhoneOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification error.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// EMAIL OTP
// ════════════════════════════════════════════════════════════════════════════

// @desc  Send OTP to email
// @route POST /api/auth/send-email-otp
export const sendEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const otp = await issueOtp(`email:${email}`);
    await sendOtpEmail(email, otp);

    return res.status(200).json({ success: true, message: 'OTP sent to email.', email });
  } catch (err) {
    const status = err.code === 'COOLDOWN' ? 429 : 500;
    console.error('sendEmailOtp error:', err.message);
    return res.status(status).json({
      success: false,
      message: err.code === 'COOLDOWN' ? err.message : (err.message || 'Failed to send email OTP.'),
    });
  }
};

// @desc  Verify email OTP
// @route POST /api/auth/verify-email-otp
export const verifyEmailOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = (req.body.otp || '').toString().trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const result = await consumeOtp(`email:${email}`, otp);
    if (!result.ok) return res.status(400).json({ success: false, message: result.reason });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.status = 'online';
      await existingUser.save();
      return res.status(200).json({
        success: true,
        isNewUser: false,
        token: generateToken(existingUser._id),
        user: userPayload(existingUser),
      });
    }

    return res.status(200).json({
      success: true,
      isNewUser: true,
      email,
      message: 'OTP verified. Please complete your profile.',
    });
  } catch (err) {
    console.error('verifyEmailOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification error.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PROFILE SETUP
// ════════════════════════════════════════════════════════════════════════════

// @desc  Complete profile for new users
// @route POST /api/auth/setup-profile
export const setupProfile = async (req, res) => {
  try {
    const { name, profilePic, about } = req.body;
    const phone = normalizePhone(req.body.phone || req.body.phoneNumber);
    const email = normalizeEmail(req.body.email);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!phone && !email) {
      return res.status(400).json({ success: false, message: 'Phone or email is required.' });
    }

    const query = phone ? { phone } : { email };
    let user = await User.findOne(query);

    const userData = {
      name: name.trim().slice(0, 25),
      profilePic: profilePic || '',
      about: about || 'Hey there! I am using WhatsApp.',
      status: 'online',
    };

    if (user) {
      Object.assign(user, userData);
      await user.save();
    } else {
      user = await User.create({
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
        ...userData,
      });
    }

    return res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: userPayload(user),
    });
  } catch (err) {
    console.error('setupProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to save profile.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET CURRENT USER
// ════════════════════════════════════════════════════════════════════════════

// @desc  Get current logged in user
// @route GET /api/auth/me
// @access Private
export const getMe = async (req, res) => {
  if (req.user) {
    return res.status(200).json(userPayload(req.user));
  }
  return res.status(404).json({ message: 'User not found.' });
};
