import express from 'express';
import {
  getMessages,
  toggleStarMessage,
  getStarredMessages,
  deleteMessageForMe,
  deleteMessageForEveryone,
  deleteChat,
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { messageRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(protect);

router.get('/starred', getStarredMessages);
router.put('/:messageId/star', messageRateLimiter, toggleStarMessage);
router.post('/:messageId/delete-for-me', deleteMessageForMe);
router.post('/:messageId/delete-for-everyone', deleteMessageForEveryone);
router.delete('/chat/:userId', deleteChat);
router.get('/:userId', getMessages);

export default router;