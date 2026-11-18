const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const { connectMongoDB, getIsMongoConnected } = require('./config/db');
const { connectRedis, getIsRedisConnected } = require('./config/redis');
const { ensureUsersSeeded } = require('./services/userService');
const { ensureUrlsSeeded } = require('./services/urlService');
const authRoutes = require('./routes/authRoutes');
const urlRoutes = require('./routes/urlRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin:
      config.clientUrl === '*'
        ? '*'
        : [config.clientUrl, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());

// System health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    workerId: config.workerId,
    mongoConnected: getIsMongoConnected(),
    redisConnected: getIsRedisConnected(),
  });
});

// Mount MVC Routes
app.use('/api/auth', authRoutes);
app.use('/', urlRoutes);

// Centralized Error Handler
app.use(errorHandler);

async function startServer() {
  await Promise.all([connectMongoDB(), connectRedis()]);
  await ensureUsersSeeded();
  await ensureUrlsSeeded();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `Server running on http://localhost:${config.port} (Worker ID: ${config.workerId})`
    );
  });
}

startServer();