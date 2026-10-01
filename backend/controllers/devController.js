import User from '../models/User.js';
import Message from '../models/Message.js';
import Group from '../models/Group.js';
import Otp from '../models/Otp.js';

// @desc  Wipe all Users, Groups, Otps and Messages (dev/reset only)
// @route GET /api/dev/reset-db
// @route POST /api/dev/reset-db
export const resetDatabase = async (req, res) => {
  try {
    const deletedMessages = await Message.deleteMany({});
    const deletedUsers = await User.deleteMany({});
    const deletedGroups = await Group.deleteMany({});
    const deletedOtps = await Otp.deleteMany({});

    console.log(
      `\x1b[31m[DB RESET]\x1b[0m 🗑️  Deleted ${deletedUsers.deletedCount} users, ${deletedGroups.deletedCount} groups, ${deletedMessages.deletedCount} messages, and ${deletedOtps.deletedCount} otps.`
    );

    return res.status(200).json({
      success: true,
      message: 'Database reset successfully. All users, groups, and messages deleted.',
      deleted: {
        users: deletedUsers.deletedCount,
        groups: deletedGroups.deletedCount,
        messages: deletedMessages.deletedCount,
        otps: deletedOtps.deletedCount,
      },
    });
  } catch (err) {
    console.error('resetDatabase error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reset database.' });
  }
};
