import mongoose from 'mongoose';

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI;

  // Explicit validation BEFORE calling mongoose.connect() —
  // this is what prevents "openUri() must be a string, got undefined"
  if (!MONGO_URI || typeof MONGO_URI !== 'string' || MONGO_URI.trim() === '') {
    console.error('\x1b[31m[DB ERROR]\x1b[0m MONGO_URI is missing or invalid.');
    console.error('\x1b[33m[HINT]\x1b[0m Add MONGO_URI=mongodb://127.0.0.1:27017/chatapp to backend/.env');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `\x1b[32m[DB]\x1b[0m MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`
    );

    mongoose.connection.on('error', (err) => {
      console.error(`\x1b[31m[DB ERROR]\x1b[0m ${err.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('\x1b[33m[DB]\x1b[0m MongoDB disconnected.');
    });

    return conn;
  } catch (error) {
    console.error(`\x1b[31m[DB ERROR]\x1b[0m Failed to connect to MongoDB: ${error.message}`);
    process.exit(1); // graceful exit — don't let the server run against a dead DB
  }
};

export default connectDB;
