import express from 'express';
import {
  getUsers,
  getConversations,
  updateProfile,
  createGroup,
  getGroups,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, getUsers);
router.route('/conversations').get(protect, getConversations);
router.route('/profile').put(protect, updateProfile);
router.route('/groups').post(protect, createGroup).get(protect, getGroups);

export default router;

