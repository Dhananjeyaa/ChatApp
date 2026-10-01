import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import User from './models/User.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import devRoutes from './routes/devRoutes.js';

// Socket
import { initSocket } from './socket/chatSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const server = createServer(app);

// Init Socket.io
initSocket(server);

// Middleware
app.use(cors({ origin: CLIENT_URL, credentials: true })); // '*' + credentials is invalid in browsers anyway
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Dev-only destructive endpoint — never mounted in production
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// Health check
app.get('/', (req, res) => res.json({ status: 'ChatApp API running' }));

const startServer = async () => {
  await connectDB(); // connects (or exits) BEFORE the server starts accepting traffic

  // Drop legacy strict phone_1 and email_1 indexes so MongoDB rebuilds them with sparse: true
  User.collection.dropIndex('phone_1').catch(() => {});
  User.collection.dropIndex('email_1').catch(() => {});

  server.listen(PORT, () => {
    console.log(`\x1b[36m[SERVER]\x1b[0m Running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\x1b[33m[DEV]\x1b[0m Reset DB → http://localhost:${PORT}/api/dev/reset-db`);
    }
  });
};

startServer();
