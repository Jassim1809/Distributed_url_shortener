const { config } = require('../config/env');

const TIER_RULES = {
  free: { name: 'Free', ttlDays: 7, allowCustomAlias: false },
  pro: { name: 'Pro', ttlDays: 90, allowCustomAlias: true },
  enterprise: { name: 'Enterprise', ttlDays: 365, allowCustomAlias: true },
};

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const EPOCH = 1704067200000n; // Custom epoch: Jan 1, 2024

function encodeBase62(num) {
  let value = BigInt(num);
  if (value === 0n) return '0';
  let encoded = '';

  while (value > 0n) {
    const remainder = Number(value % 62n);
    encoded = BASE62_CHARS[remainder] + encoded;
    value = value / 62n;
  }

  return encoded;
}

function decodeBase62(str) {
  let result = 0n;
  for (const char of str) {
    const index = BASE62_CHARS.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base62 character: ${char}`);
    result = result * 62n + BigInt(index);
  }
  return result;
}

function generateSnowflakeId(
  workerId = config.workerId,
  sequence = 0,
  timestampMs = Date.now()
) {
  const timeDelta = BigInt(Math.max(1, timestampMs - Number(EPOCH)));
  const workerBits = BigInt(workerId & 1023);
  const seqBits = BigInt(sequence & 4095);

  const id = (timeDelta << 22n) | (workerBits << 12n) | seqBits;
  return id.toString();
}

function parseSnowflakeId(snowflakeId) {
  const id = BigInt(snowflakeId);
  const sequence = Number(id & 4095n);
  const workerId = Number((id >> 12n) & 1023n);
  const timestampMs = Number((id >> 22n) + EPOCH);
  return { snowflakeId, timestampMs, workerId, sequence };
}

function computeExpirationDate(tier, fromMs = Date.now()) {
  const days = TIER_RULES[tier]?.ttlDays || 7;
  return new Date(fromMs + days * 24 * 60 * 60 * 1000);
}

function validateUrlInput({ originalUrl, customAlias, tier }) {
  const rule = TIER_RULES[tier] || TIER_RULES.free;

  try {
    const parsed = new URL((originalUrl || '').trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'URL must start with http:// or https://',
        ttlDays: rule.ttlDays,
      };
    }
  } catch {
    return { valid: false, error: 'Please enter a valid URL.', ttlDays: rule.ttlDays };
  }

  const alias = customAlias?.trim();
  if (alias) {
    if (!rule.allowCustomAlias) {
      return {
        valid: false,
        error: 'Custom aliases require Pro or Enterprise plan.',
        ttlDays: rule.ttlDays,
      };
    }
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(alias)) {
      return {
        valid: false,
        error: 'Custom alias must be 3–32 characters (letters, numbers, - or _).',
        ttlDays: rule.ttlDays,
      };
    }
    return { valid: true, normalizedAlias: alias, ttlDays: rule.ttlDays };
  }

  return { valid: true, ttlDays: rule.ttlDays };
}

module.exports = {
  TIER_RULES,
  encodeBase62,
  decodeBase62,
  generateSnowflakeId,
  parseSnowflakeId,
  computeExpirationDate,
  validateUrlInput,
};