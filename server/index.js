import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import attendanceRoutes from './routes/attendance.js';
import ingestRoutes from './routes/ingest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ingest', ingestRoutes);

// MongoDB connection helper
export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('⚠️  MONGO_URI not defined in environment variables. Database not connected.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    if (error.message && error.message.includes('querySrv ECONNREFUSED')) {
      console.warn('⚠️  SRV DNS lookup failed on local network resolver. Retrying with Google/Cloudflare DNS...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(mongoUri);
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        return;
      } catch (retryError) {
        console.error(`❌ MongoDB retry connection error: ${retryError.message}`);
        return;
      }
    }
    console.error(`❌ MongoDB connection error: ${error.message}`);
  }
};

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use by another process.`);
      console.error(`   To kill the existing process on Windows, run:`);
      console.error(`   npx kill-port ${PORT}`);
      console.error(`   Or change PORT=5001 in server/.env\n`);
    } else {
      console.error(`❌ Server startup error: ${err.message}`);
    }
  });
}

export default app;
