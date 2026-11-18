const mongoose = require('mongoose');
const { config } = require('./env');

let isMongoConnected = false;

mongoose.set('strictQuery', true);

async function connectMongoDB() {
  if (!config.mongoUri) {
    console.warn('MONGO_URI not set. Running with in-memory store fallback.');
    return;
  }

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    isMongoConnected = false;
    console.warn('MongoDB unavailable, using in-memory store fallback.');
  }
}

function getIsMongoConnected() {
  return isMongoConnected;
}

module.exports = {
  connectMongoDB,
  getIsMongoConnected,
};