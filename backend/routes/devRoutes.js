import express from 'express';
import { resetDatabase } from '../controllers/devController.js';

const router = express.Router();

// Strict security guard: only allowed when NODE_ENV is explicitly 'development',
// and optionally require DEV_RESET_SECRET if set.
const requireDevEnv = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Database reset is strictly restricted to development environment.',
    });
  }

  // If DEV_RESET_SECRET is defined in development, verify it
  const expectedSecret = process.env.DEV_RESET_SECRET;
  if (expectedSecret) {
    const provided = req.headers['x-dev-secret'] || req.query.secret;
    if (provided !== expectedSecret) {
      return res.status(403).json({ success: false, message: 'Forbidden: Invalid dev secret.' });
    }
  }

  next();
};

// GET  /api/dev/reset-db
// POST /api/dev/reset-db
router.get('/reset-db', requireDevEnv, resetDatabase);
router.post('/reset-db', requireDevEnv, resetDatabase);

export default router;
