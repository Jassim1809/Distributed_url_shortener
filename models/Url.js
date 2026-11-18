const mongoose = require('mongoose');

const UrlSchema = new mongoose.Schema({
  shortCode: { type: String, required: true, unique: true, index: true },
  snowflakeId: { type: String, required: true },
  originalUrl: { type: String, required: true },
  customAlias: { type: String, default: null },
  userId: { type: String, required: true },
  tier: { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
  ttlDays: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  // Native MongoDB TTL index automatically purges expired documents
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  clicks: { type: Number, default: 0 },
});

const UrlModel = mongoose.models.Url || mongoose.model('Url', UrlSchema);

module.exports = UrlModel;