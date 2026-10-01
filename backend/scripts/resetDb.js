/**
 * CLI Script: Wipe all Users and Messages from MongoDB
 * Usage: node backend/scripts/resetDb.js
 * Or:    npm run reset-db   (from backend/ directory)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatapp';

async function resetDb() {
  try {
    console.log('\x1b[36m[RESET-DB]\x1b[0m Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('\x1b[32m[RESET-DB]\x1b[0m Connected!');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    let totalDeleted = 0;
    for (const col of collections) {
      const result = await db.collection(col.name).deleteMany({});
      totalDeleted += result.deletedCount;
      console.log(`\x1b[31m[RESET-DB]\x1b[0m Cleared "${col.name}" → ${result.deletedCount} documents deleted.`);
    }

    console.log(`\x1b[33m[RESET-DB]\x1b[0m ✅ Done! Total deleted: ${totalDeleted} records.`);
  } catch (err) {
    console.error('\x1b[31m[RESET-DB ERROR]\x1b[0m', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetDb();
