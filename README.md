# ChatApp 💬

A production-grade, high-concurrency, ultra-low latency real-time chat application featuring Redis presence caching, Socket.IO cluster adaptation, dual-OTP authentication (Email & SMS), cursor-based pagination, and permanent message deletion.

## 🚀 Architectural Highlights & Key Features

- **Redis Caching & Real-Time Presence**: In-memory Redis store (`ioredis`) for tracking online status and socket mappings with zero database writes during connection/disconnection.
- **Horizontal Scaling**: Socket.IO Redis Adapter (`@socket.io/redis-adapter`) enabling seamless multi-instance horizontal clustering.
- **Cursor-Based Pagination**: Ultra-fast message history retrieval using indexed `_id: { $lt: cursor }` pagination with `.lean()` and targeted field projections.
- **Optimized MongoDB Compound Indexes**: High-performance indexes on `{ conversationId: 1, createdAt: -1 }`, `{ senderId: 1, receiverId: 1, createdAt: -1 }`, and `{ conversationId: 1, _id: -1 }`.
- **API Security & Rate Limiting**: Distributed rate limiting (`express-rate-limit` with `rate-limit-redis`) protecting OTP and message endpoints against DDoS and SMS cost drain.
- **Network Optimization**: HTTP response compression (`compression`) and strict payload limits.
- **Render Performance & Memory Leak Prevention**: Core components (`Sidebar`, `ChatArea`/`ChatContainer`, `MessageItem`, `ChatLayout`) wrapped in `React.memo` with custom shallow equality comparators and leak-proof Socket.IO cleanup.
- **Dual-OTP Authentication**: Fast verification via Gmail SMTP (Google App Password) and SMS (Fast2SMS / Twilio).
- **Permanent Message Deletion**: Full deletion capabilities ensuring user privacy and data security.

## 📁 Project Structure

```
ChatApp/
├── backend/
│   ├── config/          # MongoDB & Redis configurations
│   ├── controllers/     # Route logic (Auth, Message, User, Dev)
│   ├── middleware/      # Auth guard, rate limiters
│   ├── models/          # Mongoose schemas (User, Message, Group, Otp)
│   ├── routes/          # Express route definitions
│   ├── socket/          # Socket.io server with Redis presence
│   ├── utils/           # OTP generation, mailer, SMS dispatchers
│   ├── .env.example     # Environment template (NO secrets)
│   ├── package.json
│   └── server.js        # Main backend entry point
├── frontend/
│   ├── src/             # React components (memoized), contexts, hooks, pages
│   ├── index.html       # Updated title & modern SVG favicon
│   ├── package.json
│   └── vite.config.js
├── .gitignore           # Strict ignore protecting .env and node_modules
├── package.json         # Root runner script
└── README.md
```

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance (Local or Atlas)
- Redis instance (Local or Cloud; app gracefully falls back to in-memory if Redis is offline)
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords)

### 2. Environment Setup
Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chatapp
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Redis (Optional; defaults to redis://127.0.0.1:6379 with automatic in-memory fallback)
REDIS_URL=redis://127.0.0.1:6379

# Email OTP (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# SMS OTP (Optional / Fast2SMS)
FAST2SMS_API_KEY=
```

### 3. Installation & Running
From the root directory:

```bash
# Install root dependencies
npm install

# Install backend and frontend dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Run both backend and frontend concurrently
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## 🔒 Security Best Practices
- Sensitive `.env` files and API keys are strictly excluded via `.gitignore` and must never be committed to source control.
- Always use Google App Passwords instead of personal account passwords for SMTP.
