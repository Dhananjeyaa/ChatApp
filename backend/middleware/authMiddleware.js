import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const userId = decoded.id || decoded._id;
      if (!userId) {
        return res.status(401).json({ message: 'Not authorized, invalid token payload' });
      }

      // Fast lean projection bypassing mongoose hydration overhead
      req.user = await User.findById(userId)
        .select('_id name phone email profilePic status lastSeen deletedChats')
        .lean();

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      return next();
    } catch {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};
