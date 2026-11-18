const { config } = require('../config/env');
const { cacheSet, getNextSequence } = require('../services/cacheService');
const {
  getAllUrls,
  findUrlByCode,
  createUrlRecord,
  deleteUrlByCode,
  lookupOriginalUrl,
} = require('../services/urlService');
const {
  computeExpirationDate,
  encodeBase62,
  generateSnowflakeId,
  validateUrlInput,
} = require('../utils/snowflake');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const shortenUrl = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, 'Please sign in first.');
  }

  const { originalUrl, customAlias } = req.body;
  const check = validateUrlInput({
    originalUrl: originalUrl || '',
    customAlias,
    tier: req.user.tier,
  });

  if (!check.valid) {
    throw new ApiError(400, check.error);
  }

  if (check.normalizedAlias && (await findUrlByCode(check.normalizedAlias))) {
    throw new ApiError(409, 'That custom alias is already taken.');
  }

  // Generate unique 64-bit Snowflake ID and Base62 short code
  const sequence = await getNextSequence(config.workerId);
  const snowflakeId = generateSnowflakeId(config.workerId, sequence);
  const shortCode = check.normalizedAlias || encodeBase62(BigInt(snowflakeId));
  const expiresAtDate = computeExpirationDate(req.user.tier);

  const saved = await createUrlRecord({
    shortCode,
    snowflakeId,
    originalUrl: originalUrl.trim(),
    customAlias: check.normalizedAlias || null,
    userId: req.user.userId,
    tier: req.user.tier,
    ttlDays: check.ttlDays,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAtDate.toISOString(),
    clicks: 0,
  });

  // Pre-warm Redis cache for immediate sub-millisecond reads
  const ttlSeconds = check.ttlDays * 24 * 60 * 60;
  await cacheSet(`url:${shortCode}`, saved.originalUrl, ttlSeconds);

  res.status(201).json({ url: saved });
});

const listUrls = asyncHandler(async (_req, res) => {
  const urls = await getAllUrls();
  res.json({ urls });
});

const deleteUrl = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  const deleted = await deleteUrlByCode(code);

  if (!deleted) {
    throw new ApiError(404, 'Link not found.');
  }

  res.json({ deleted: true });
});

const resolveUrl = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  const result = await lookupOriginalUrl(code);

  if (result.status === 'not_found') {
    throw new ApiError(404, 'Short link not found.');
  }

  if (result.status === 'expired') {
    throw new ApiError(410, 'This link has expired.');
  }

  res.json({ shortCode: code, originalUrl: result.originalUrl });
});

const redirectUrl = asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim();
  const result = await lookupOriginalUrl(code);

  if (result.status === 'not_found') {
    res.status(404).send('Link not found');
    return;
  }

  if (result.status === 'expired') {
    res.status(410).send('This link has expired');
    return;
  }

  res.redirect(302, result.originalUrl);
});

module.exports = {
  shortenUrl,
  listUrls,
  deleteUrl,
  resolveUrl,
  redirectUrl,
};