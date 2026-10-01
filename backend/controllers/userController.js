import User from '../models/User.js';
import Message from '../models/Message.js';
import Group from '../models/Group.js';

// @desc    Get all active conversations (or search users) with last message preview
// @route   GET /api/users
// @route   GET /api/users/conversations
// @access  Private
export const getUsers = async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';
    const isSearching = Boolean(search);

    const currentUser = await User.findById(req.user._id).select('deletedChats');
    const deletedChats = (currentUser?.deletedChats || []).map((id) => id.toString());

    let users = [];

    if (isSearching) {
      // When searching via search bar: search across all registered users
      const searchRegex = { $regex: search, $options: 'i' };
      users = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
        ],
      }).select('-password');
    } else {
      // When loading sidebar chat list: EXCLUDE any user who has no existing messages or is in deletedChats
      const sentPartners = await Message.distinct('receiver', {
        sender: req.user._id,
        isGroup: { $ne: true },
      });
      const receivedPartners = await Message.distinct('sender', {
        receiver: req.user._id,
        isGroup: { $ne: true },
      });
      const sentPartnersLegacy = await Message.distinct('receiverId', {
        senderId: req.user._id,
        isGroup: { $ne: true },
      });
      const receivedPartnersLegacy = await Message.distinct('senderId', {
        receiverId: req.user._id,
        isGroup: { $ne: true },
      });

      const partnerIds = [
        ...new Set([
          ...sentPartners.filter(Boolean).map((id) => id.toString()),
          ...receivedPartners.filter(Boolean).map((id) => id.toString()),
          ...sentPartnersLegacy.filter(Boolean).map((id) => id.toString()),
          ...receivedPartnersLegacy.filter(Boolean).map((id) => id.toString()),
        ]),
      ].filter((id) => id !== req.user._id.toString() && !deletedChats.includes(id));

      if (partnerIds.length === 0) {
        return res.json([]);
      }

      users = await User.find({
        _id: { $in: partnerIds },
      }).select('-password');
    }

    // Fetch last message & unread count for each user (WhatsApp-style chat list)
    const usersWithLastMessage = await Promise.all(
      users.map(async (u) => {
        const lastMsg = await Message.findOne({
          $or: [
            { sender: req.user._id, receiver: u._id },
            { sender: u._id, receiver: req.user._id },
            { senderId: req.user._id, receiverId: u._id },
            { senderId: u._id, receiverId: req.user._id },
          ],
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          $or: [
            { sender: u._id, receiver: req.user._id },
            { senderId: u._id, receiverId: req.user._id },
          ],
          status: { $ne: 'read' },
        });

        return {
          ...u.toObject(),
          isGroup: false,
          lastMessage: lastMsg
            ? {
                _id: lastMsg._id,
                message: lastMsg.message,
                messageType: lastMsg.messageType || 'text',
                sender: lastMsg.sender || lastMsg.senderId,
                receiver: lastMsg.receiver || lastMsg.receiverId,
                status: lastMsg.status,
                timestamp: lastMsg.createdAt || lastMsg.timestamp,
              }
            : null,
          unreadCount,
        };
      })
    );

    // If NOT searching, strictly exclude any user with 0 existing messages or in deletedChats
    const filteredUsers = isSearching
      ? usersWithLastMessage
      : usersWithLastMessage.filter((u) => u.lastMessage !== null && !deletedChats.includes(u._id.toString()));

    // Sort: most-recent conversation first, then alphabetically
    filteredUsers.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

    return res.json(filteredUsers);
  } catch (error) {
    console.error('getUsers error:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
};

export const getConversations = getUsers;

// @desc    Update user profile (name, about, profilePic)
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, about, profilePic } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name.trim().slice(0, 25);
    if (about !== undefined) user.about = about;
    if (profilePic !== undefined) user.profilePic = profilePic;

    await user.save();
    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        profilePic: user.profilePic,
        about: user.about,
        status: user.status,
        lastSeen: user.lastSeen,
      },
    });
  } catch (error) {
    console.error('updateProfile error:', error.message);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
};

// @desc    Create a new group chat
// @route   POST /api/users/groups
// @access  Private
export const createGroup = async (req, res) => {
  try {
    const { name, members, groupPic, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'Please select at least 1 contact' });
    }

    const memberSet = new Set(members.map((m) => m.toString()));
    memberSet.add(req.user._id.toString());

    const group = await Group.create({
      name: name.trim(),
      admin: req.user._id,
      members: Array.from(memberSet),
      groupPic: groupPic || '',
      description: description || 'Group created on ChatApp',
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('members', 'name phone email profilePic status lastSeen')
      .populate('admin', 'name phone email profilePic');

    return res.status(201).json({
      success: true,
      group: {
        ...populatedGroup.toObject(),
        isGroup: true,
      },
    });
  } catch (error) {
    console.error('createGroup error:', error.message);
    return res.status(500).json({ message: 'Failed to create group' });
  }
};

// @desc    Get all groups the logged-in user belongs to
// @route   GET /api/users/groups
// @access  Private
export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'name phone email profilePic status lastSeen')
      .populate('admin', 'name phone email profilePic')
      .sort({ updatedAt: -1 });

    const groupsWithData = await Promise.all(
      groups.map(async (g) => {
        const lastMsg = await Message.findOne({
          conversationId: g._id.toString(),
        }).sort({ createdAt: -1 });

        return {
          ...g.toObject(),
          isGroup: true,
          lastMessage: lastMsg
            ? {
                _id: lastMsg._id,
                message: lastMsg.message,
                messageType: lastMsg.messageType || 'text',
                sender: lastMsg.sender,
                status: lastMsg.status,
                timestamp: lastMsg.createdAt || lastMsg.timestamp,
              }
            : null,
          unreadCount: 0,
        };
      })
    );

    return res.json(groupsWithData);
  } catch (error) {
    console.error('getGroups error:', error.message);
    return res.status(500).json({ message: 'Failed to fetch groups' });
  }
};

