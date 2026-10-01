import express from 'express';
import {
  getMessages,
  toggleStarMessage,
  getStarredMessages,
  deleteChat,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/starred', protect, getStarredMessages);
router.put('/:messageId/star', protect, toggleStarMessage);
router.delete('/chat/:userId', protect, deleteChat);
router.get('/:userId', protect, getMessages);

export default router;