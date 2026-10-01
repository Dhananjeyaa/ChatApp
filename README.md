# ChatApp 💬

A modern, secure, full-stack real-time chat application featuring dual-OTP authentication (Email & SMS), responsive modern UI, and permanent message deletion.

## 🚀 Key Features

- **Dual-OTP Authentication**: Fast and secure verification via Gmail SMTP (Google App Password) and SMS (Fast2SMS / Twilio).
- **Real-Time Messaging**: Built on Socket.IO for low-latency bidirectional communication.
- **Permanent Message Deletion**: Full deletion capabilities ensuring user privacy and data security.
- **Modern Responsive UI**: Clean, mobile-friendly interface designed with React and TailwindCSS.
- **JWT & Password Security**: Industry-standard bcrypt password hashing and token-based session handling.
- **MongoDB & Mongoose**: Resilient database modeling and query performance.

## 📁 Project Structure

```
ChatApp/
├── backend/
│   ├── config/          # Database and service configurations
│   ├── controllers/     # Route logic (Auth, Chat, Message, User)
│   ├── middleware/      # Auth guard, error handling
│   ├── models/          # Mongoose schemas (User, Message, Conversation)
│   ├── routes/          # Express route definitions
│   ├── utils/           # OTP generation, mailer, SMS dispatchers
│   ├── .env.example     # Environment template (NO secrets)
│   ├── package.json
│   └── server.js        # Main backend entry point
├── frontend/
│   ├── src/             # React components, contexts, hooks, pages
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore           # Root gitignore protecting .env and node_modules
├── package.json         # Root runner script
└── README.md
```

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance (Local or Atlas)
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords)

### 2. Environment Setup
Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/chatapp
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
NODE_ENV=development

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
