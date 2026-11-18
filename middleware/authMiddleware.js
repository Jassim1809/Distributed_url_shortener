const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { TIER_RULES } = require('../utils/snowflake');
const { findUserById } = require('../services/userService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d' });
}

const authenticateJWT = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Please sign in first.');
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, config.jwtSecret);
    const dbUser = await findUserById(decoded.userId);

    req.user = dbUser
      ? { userId: dbUser.id, email: dbUser.email, name: dbUser.name, tier: dbUser.tier }
      : decoded;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired session.');
  }
});

function enforceTierPolicy(req, _res, next) {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized.'));
  }

  const rule = TIER_RULES[req.user.tier] || TIER_RULES.free;
  const customAlias = req.body?.customAlias?.trim();

  if (customAlias && !rule.allowCustomAlias) {
    return next(
      new ApiError(403, 'Custom aliases are only available on Pro and Enterprise plans.')
    );
  }

  next();
}

module.exports = {
  signToken,
  authenticateJWT,
  enforceTierPolicy,
};