import express from 'express';
import { resetDatabase } from '../controllers/devController.js';

const router = express.Router();

// Extra guard: even in development, require a shared secret header
// to avoid accidental wipes from stray requests/browser tabs.
const requireDevSecret = (req, res, next) => {
  const provided = req.headers['x-dev-secret'];
  const expected = process.env.DEV_RESET_SECRET;

  if (!expected) {
    return res.status(500).json({
      success: false,
      message: 'DEV_RESET_SECRET not set — refusing to run a destructive action.',
    });
  }
  if (provided !== expected) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }
  next();
};

// GET  /api/dev/reset-db  (browser-friendly)
// POST /api/dev/reset-db  (curl/fetch-friendly)
router.get('/reset-db', requireDevSecret, resetDatabase);
router.post('/reset-db', requireDevSecret, resetDatabase);

export default router;
