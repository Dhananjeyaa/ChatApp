import Message from '../models/Message.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { getConversationId } from '../utils/chatUtils.js';

// @desc    Get chat history between current user and selected user (or group)
// @route   GET /api/messages/:userId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    const myId = req.user._id;

    // Determine if targetId is a group ID or user ID
    let isGroup = false;
    try {
      isGroup = await Group.exists({ _id: targetId });
    } catch {
      isGroup = false;
    }

    const conversationId = isGroup ? targetId : getConversationId(myId, targetId);

    const messages = await Message.find({ conversationId })
      .populate('sender', 'name profilePic')
      .sort({ createdAt: 1 });

    if (!isGroup) {
      // Mark any unread messages sent by targetId to me as 'read'
      await Message.updateMany(
        { sender: targetId, receiver: myId, status: { $ne: 'read' } },
        { status: 'read' }
      );
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error in getMessages controller:', error.message);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

// @desc    Toggle star/bookmark on a message
// @route   PUT /api/messages/:messageId/star
// @access  Private
export const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const userIdStr = req.user._id.toString();
    const isStarred = (message.starredBy || []).some((id) => id.toString() === userIdStr);

    if (isStarred) {
      message.starredBy = message.starredBy.filter((id) => id.toString() !== userIdStr);
    } else {
      if (!message.starredBy) message.starredBy = [];
      message.starredBy.push(req.user._id);
    }

    await message.save();

    return res.status(200).json({
      success: true,
      messageId: message._id,
      starred: !isStarred,
    });
  } catch (error) {
    console.error('Error in toggleStarMessage:', error.message);
    res.status(500).json({ message: 'Server error while toggling star' });
  }
};

// @desc    Get all starred messages for the logged-in user
// @route   GET /api/messages/starred
// @access  Private
export const getStarredMessages = async (req, res) => {
  try {
    const messages = await Message.find({ starredBy: req.user._id })
      .populate('sender', 'name profilePic')
      .populate('receiver', 'name profilePic')
      .sort({ createdAt: -1 });

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Error in getStarredMessages:', error.message);
    res.status(500).json({ message: 'Server error while fetching starred messages' });
  }
};

// @desc    Delete all messages in a 1-to-1 conversation
// @route   DELETE /api/messages/chat/:userId
// @access  Private
export const deleteChat = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    const myId = req.user._id;

    // Check if targetId is a group
    let isGroup = false;
    try {
      isGroup = await Group.exists({ _id: targetId });
    } catch {
      isGroup = false;
    }

    if (isGroup) {
      await Message.deleteMany({
        $or: [{ conversationId: targetId }, { groupId: targetId }],
      });
      return res.status(200).json({ success: true, message: 'Group chat deleted successfully' });
    }

    const conversationId = getConversationId(myId, targetId);

    // Permanently delete all messages between req.user._id and userId
    await Message.deleteMany({
      $or: [
        { senderId: myId, receiverId: targetId },
        { senderId: targetId, receiverId: myId },
        { sender: myId, receiver: targetId },
        { sender: targetId, receiver: myId },
        { conversationId },
      ],
    });

    // Mark this chat as hidden/deleted for req.user._id in User schema
    await User.findByIdAndUpdate(myId, {
      $addToSet: { deletedChats: targetId },
    });

    return res.status(200).json({ success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error in deleteChat controller:', error.message);
    res.status(500).json({ message: 'Server error while deleting chat' });
  }
};

