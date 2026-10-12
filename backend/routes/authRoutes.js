import express from 'express';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtp,
  verifyEmailOtp,
  setupProfile,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply auth rate limiting to sensitive OTP creation/verification endpoints
router.use('/send-phone-otp', authRateLimiter);
router.use('/verify-phone-otp', authRateLimiter);
router.use('/send-email-otp', authRateLimiter);
router.use('/verify-email-otp', authRateLimiter);
router.use('/setup-profile', authRateLimiter);

// Phone OTP flow
router.post('/send-phone-otp', sendPhoneOtp);
router.post('/verify-phone-otp', verifyPhoneOtp);

// Email OTP flow
router.post('/send-email-otp', sendEmailOtp);
router.post('/verify-email-otp', verifyEmailOtp);

// Profile setup (new users)
router.post('/setup-profile', setupProfile);

// Current user
router.get('/me', protect, getMe);

export default router;
