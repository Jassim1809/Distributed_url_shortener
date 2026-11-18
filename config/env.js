const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-key',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Generalized worker ID (0-1023) from environment or process PID
  workerId: Number(process.env.WORKER_ID ?? process.pid) % 1024,
};

module.exports = { config };