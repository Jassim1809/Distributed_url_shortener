const UrlModel = require('../models/Url');
const { getIsMongoConnected } = require('../config/db');
const { cacheGet, cacheSet, cacheDel } = require('./cacheService');
const { encodeBase62, generateSnowflakeId } = require('../utils/snowflake');

const memoryUrls = [];
let seeded = false;

async function ensureUrlsSeeded() {
  if (seeded) return;
  seeded = true;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const s1 = generateSnowflakeId(1, 1, now - 2 * dayMs);
  const s2 = generateSnowflakeId(2, 2, now - 1 * dayMs);
  const s3 = generateSnowflakeId(3, 3, now - 3 * dayMs);

  const initialUrls = [
    {
      id: 'url_1',
      shortCode: 'q4-launch',
      snowflakeId: s1,
      originalUrl: 'https://stripe.com/blog/payment-links-and-checkout-improvements',
      customAlias: 'q4-launch',
      userId: 'usr_pro_alex',
      tier: 'pro',
      ttlDays: 90,
      createdAt: new Date(now - 2 * dayMs).toISOString(),
      expiresAt: new Date(now + 88 * dayMs).toISOString(),
      clicks: 128,
    },
    {
      id: 'url_2',
      shortCode: encodeBase62(BigInt(s2)),
      snowflakeId: s2,
      originalUrl: 'https://linear.app/method/project-management-guide',
      customAlias: null,
      userId: 'usr_free_sam',
      tier: 'free',
      ttlDays: 7,
      createdAt: new Date(now - 1 * dayMs).toISOString(),
      expiresAt: new Date(now + 6 * dayMs).toISOString(),
      clicks: 42,
    },
    {
      id: 'url_3',
      shortCode: 'design-kit',
      snowflakeId: s3,
      originalUrl: 'https://www.figma.com/best-practices/design-systems-guide/',
      customAlias: 'design-kit',
      userId: 'usr_ent_elena',
      tier: 'enterprise',
      ttlDays: 365,
      createdAt: new Date(now - 3 * dayMs).toISOString(),
      expiresAt: new Date(now + 362 * dayMs).toISOString(),
      clicks: 319,
    },
  ];

  for (const item of initialUrls) {
    memoryUrls.push(item);
    await cacheSet(`url:${item.shortCode}`, item.originalUrl, item.ttlDays * 86400);

    if (getIsMongoConnected()) {
      const exists = await UrlModel.findOne({ shortCode: item.shortCode }).lean();
      if (!exists) {
        await UrlModel.create({
          shortCode: item.shortCode,
          snowflakeId: item.snowflakeId,
          originalUrl: item.originalUrl,
          customAlias: item.customAlias,
          userId: item.userId,
          tier: item.tier,
          ttlDays: item.ttlDays,
          createdAt: new Date(item.createdAt),
          expiresAt: new Date(item.expiresAt),
          clicks: item.clicks,
        });
      }
    }
  }
}

async function getAllUrls() {
  await ensureUrlsSeeded();

  if (getIsMongoConnected()) {
    const docs = await UrlModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => ({
      id: String(d._id),
      shortCode: d.shortCode,
      snowflakeId: d.snowflakeId,
      originalUrl: d.originalUrl,
      customAlias: d.customAlias,
      userId: d.userId,
      tier: d.tier,
      ttlDays: d.ttlDays,
      createdAt: new Date(d.createdAt).toISOString(),
      expiresAt: new Date(d.expiresAt).toISOString(),
      clicks: d.clicks,
    }));
  }

  return [...memoryUrls];
}

async function findUrlByCode(shortCode) {
  await ensureUrlsSeeded();

  if (getIsMongoConnected()) {
    const d = await UrlModel.findOne({ shortCode }).lean();
    if (!d) return null;
    return {
      id: String(d._id),
      shortCode: d.shortCode,
      snowflakeId: d.snowflakeId,
      originalUrl: d.originalUrl,
      customAlias: d.customAlias,
      userId: d.userId,
      tier: d.tier,
      ttlDays: d.ttlDays,
      createdAt: new Date(d.createdAt).toISOString(),
      expiresAt: new Date(d.expiresAt).toISOString(),
      clicks: d.clicks,
    };
  }

  return memoryUrls.find((u) => u.shortCode === shortCode) || null;
}

async function createUrlRecord(data) {
  await ensureUrlsSeeded();

  if (getIsMongoConnected()) {
    const doc = await UrlModel.create({
      ...data,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
    });
    return { ...data, id: String(doc._id) };
  }

  const record = {
    ...data,
    id: `url_${Date.now()}`,
  };
  memoryUrls.unshift(record);
  return record;
}

async function incrementUrlClicks(shortCode) {
  await ensureUrlsSeeded();

  if (getIsMongoConnected()) {
    await UrlModel.updateOne({ shortCode }, { $inc: { clicks: 1 } });
    return;
  }

  const item = memoryUrls.find((u) => u.shortCode === shortCode);
  if (item) {
    item.clicks += 1;
  }
}

async function deleteUrlByCode(shortCode) {
  await ensureUrlsSeeded();
  await cacheDel(`url:${shortCode}`);

  if (getIsMongoConnected()) {
    const res = await UrlModel.deleteOne({ shortCode });
    return res.deletedCount > 0;
  }

  const idx = memoryUrls.findIndex((u) => u.shortCode === shortCode);
  if (idx === -1) return false;
  memoryUrls.splice(idx, 1);
  return true;
}

async function lookupOriginalUrl(code) {
  // 1. Fast path: Check Redis cache first
  const cachedUrl = await cacheGet(`url:${code}`);
  if (cachedUrl) {
    await incrementUrlClicks(code);
    return { status: 'ok', originalUrl: cachedUrl };
  }

  // 2. Fallback path: Query MongoDB / In-memory store
  const record = await findUrlByCode(code);
  if (!record) {
    return { status: 'not_found' };
  }

  const expiresMs = new Date(record.expiresAt).getTime();
  if (expiresMs <= Date.now()) {
    return { status: 'expired' };
  }

  // 3. Populate Redis cache for future reads
  const remainingSeconds = Math.max(1, Math.floor((expiresMs - Date.now()) / 1000));
  await cacheSet(`url:${code}`, record.originalUrl, remainingSeconds);
  await incrementUrlClicks(code);

  return { status: 'ok', originalUrl: record.originalUrl };
}

module.exports = {
  ensureUrlsSeeded,
  getAllUrls,
  findUrlByCode,
  createUrlRecord,
  incrementUrlClicks,
  deleteUrlByCode,
  lookupOriginalUrl,
};