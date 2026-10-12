import Message from '../models/Message.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { getConversationId } from '../utils/chatUtils.js';

// ─── Projections ─────────────────────────────────────────────────────────────
const MESSAGE_PROJECTION =
  '_id conversationId sender receiver isGroup groupId message messageType mediaUrl mediaDuration status starredBy deletedFor isDeleted deletedAt createdAt timestamp';

// @desc    Get chat history with cursor-based pagination
// @route   GET /api/messages/:userId?cursor=<lastId>&limit=50
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const myId = req.user._id;

    // Determine if targetId is a group ID or user ID
    let isGroup = false;
    try {
      isGroup = await Group.exists({ _id: targetId });
    } catch {
      isGroup = false;
    }

    const conversationId = isGroup ? targetId : getConversationId(myId, targetId);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    // Filter out messages deleted specifically for the requesting user
    const filter = {
      conversationId,
      deletedFor: { $ne: myId },
    };
    if (cursor) {
      filter._id = { $lt: cursor };
    }

    // High performance query: indexed on { conversationId: 1, _id: -1 }, lean + selective projection
    const rawMessages = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .select(MESSAGE_PROJECTION)
      .populate('sender', 'name profilePic')
      .populate('receiver', 'name profilePic')
      .lean();

    const hasMore = rawMessages.length > pageSize;
    const paginatedMessages = hasMore ? rawMessages.slice(0, pageSize) : rawMessages;

    // Reverse to chronological order (oldest to newest) for UI consumption
    paginatedMessages.reverse();

    const nextCursor = hasMore && paginatedMessages.length > 0 ? paginatedMessages[0]._id : null;

    if (!isGroup) {
      // Mark unread messages sent by target to me as read asynchronously
      Message.updateMany(
        { sender: targetId, receiver: myId, status: { $ne: 'read' } },
        { status: 'read' }
      ).catch((err) => console.warn('mark read update error:', err.message));
    }

    // Set cursor pagination metadata headers
    res.set('X-Has-More', String(hasMore));
    if (nextCursor) res.set('X-Next-Cursor', String(nextCursor));

    // Support both structured paginated response and direct array format
    if (req.query.paginated === 'true') {
      return res.status(200).json({
        messages: paginatedMessages,
        nextCursor,
        hasMore,
      });
    }

    return res.status(200).json(paginatedMessages);
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
    const userId = req.user._id;

    const message = await Message.findById(messageId).select('_id starredBy').lean();
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isStarred = (message.starredBy || []).some(
      (id) => id.toString() === userId.toString()
    );

    const update = isStarred
      ? { $pull: { starredBy: userId } }
      : { $addToSet: { starredBy: userId } };

    await Message.findByIdAndUpdate(messageId, update);

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
    const messages = await Message.find({
      starredBy: req.user._id,
      deletedFor: { $ne: req.user._id },
    })
      .sort({ createdAt: -1 })
      .select(MESSAGE_PROJECTION)
      .populate('sender', 'name profilePic')
      .populate('receiver', 'name profilePic')
      .lean();

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Error in getStarredMessages:', error.message);
    res.status(500).json({ message: 'Server error while fetching starred messages' });
  }
};

// @desc    Delete message for current user only ("Delete for Me")
// @route   POST /api/messages/:messageId/delete-for-me
// @access  Private
export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add user ID to deletedFor array
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: userId },
    });

    return res.status(200).json({
      success: true,
      messageId,
      deletedForMe: true,
    });
  } catch (error) {
    console.error('Error in deleteMessageForMe controller:', error.message);
    res.status(500).json({ message: 'Server error while deleting message for me' });
  }
};

// @desc    Delete message for everyone ("Delete for Everyone")
// @route   POST /api/messages/:messageId/delete-for-everyone
// @access  Private
export const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Security check: Only the sender can delete for everyone
    const senderId = (message.sender?._id || message.sender || message.senderId)?.toString();
    if (senderId !== userId.toString()) {
      return res.status(403).json({ message: 'Only the sender can delete this message for everyone' });
    }

    // Mark as deleted, clear media and message content for privacy
    message.isDeleted = true;
    message.message = 'This message was deleted';
    message.mediaUrl = '';
    message.mediaDuration = 0;
    message.deletedAt = new Date();
    await message.save();

    return res.status(200).json({
      success: true,
      messageId,
      message: 'This message was deleted',
      isDeleted: true,
      conversationId: message.conversationId,
      receiverId: message.receiver?.toString() || message.receiverId?.toString(),
    });
  } catch (error) {
    console.error('Error in deleteMessageForEveryone controller:', error.message);
    res.status(500).json({ message: 'Server error while deleting message for everyone' });
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

    // Permanently delete all messages utilizing compound indexes
    await Message.deleteMany({
      $or: [
        { conversationId },
        { sender: myId, receiver: targetId },
        { sender: targetId, receiver: myId },
        { senderId: myId, receiverId: targetId },
        { senderId: targetId, receiverId: myId },
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
