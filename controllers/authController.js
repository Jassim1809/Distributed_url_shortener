const bcrypt = require('bcryptjs');
const {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserTier,
} = require('../services/userService');
const { signToken } = require('../middleware/authMiddleware');
const { TIER_RULES } = require('../utils/snowflake');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, tier } = req.body;

  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    throw new ApiError(400, 'Please provide name, valid email, and a 6+ character password.');
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const selectedTier = tier === 'pro' || tier === 'enterprise' ? tier : 'free';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await createUser({
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    tier: selectedTier,
  });

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
  });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.tier,
      ttlDays: TIER_RULES[user.tier].ttlDays,
    },
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.tier,
      ttlDays: TIER_RULES[user.tier].ttlDays,
    },
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, 'Not signed in.');
  }

  const user = await findUserById(req.user.userId);
  const tier = user?.tier || req.user.tier;

  res.json({
    user: {
      id: req.user.userId,
      name: user?.name || req.user.name,
      email: user?.email || req.user.email,
      tier,
      ttlDays: TIER_RULES[tier].ttlDays,
    },
  });
});

const updateSubscriptionTier = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, 'Not signed in.');
  }

  const { tier } = req.body;
  if (!['free', 'pro', 'enterprise'].includes(tier)) {
    throw new ApiError(400, 'Invalid plan selected.');
  }

  const updated = await updateUserTier(req.user.userId, tier);
  const current = updated || { ...req.user, id: req.user.userId, tier };

  const token = signToken({
    userId: current.id,
    email: current.email,
    name: current.name,
    tier: current.tier,
  });

  res.json({
    token,
    user: {
      id: current.id,
      name: current.name,
      email: current.email,
      tier: current.tier,
      ttlDays: TIER_RULES[current.tier].ttlDays,
    },
  });
});

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateSubscriptionTier,
};