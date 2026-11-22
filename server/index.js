import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
