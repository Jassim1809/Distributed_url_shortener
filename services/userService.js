const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/User');
const { getIsMongoConnected } = require('../config/db');

const memoryUsers = [];
let seeded = false;

async function ensureUsersSeeded() {
  if (seeded) return;
  seeded = true;

  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const initialUsers = [
    {
      id: 'usr_pro_alex',
      name: 'Alex Rivera',
      email: 'alex.pro@snowflakeurl.io',
      passwordHash,
      tier: 'pro',
    },
    {
      id: 'usr_free_sam',
      name: 'Sam Chen',
      email: 'sam.free@snowflakeurl.io',
      passwordHash,
      tier: 'free',
    },
    {
      id: 'usr_ent_elena',
      name: 'Elena Rostova',
      email: 'elena.enterprise@snowflakeurl.io',
      passwordHash,
      tier: 'enterprise',
    },
  ];

  memoryUsers.push(...initialUsers);

  if (getIsMongoConnected()) {
    for (const u of initialUsers) {
      const exists = await UserModel.findOne({ email: u.email }).lean();
      if (!exists) {
        await UserModel.create({
          name: u.name,
          email: u.email,
          passwordHash: u.passwordHash,
          tier: u.tier,
        });
      }
    }
  }
}

async function findUserByEmail(email) {
  await ensureUsersSeeded();
  const cleanEmail = email.trim().toLowerCase();

  if (getIsMongoConnected()) {
    const doc = await UserModel.findOne({ email: cleanEmail }).lean();
    if (doc) {
      return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        passwordHash: doc.passwordHash,
        tier: doc.tier,
      };
    }
  }

  return memoryUsers.find((u) => u.email === cleanEmail) || null;
}

async function findUserById(id) {
  await ensureUsersSeeded();

  if (getIsMongoConnected() && mongoose.Types.ObjectId.isValid(id)) {
    const doc = await UserModel.findById(id).lean();
    if (doc) {
      return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        passwordHash: doc.passwordHash,
        tier: doc.tier,
      };
    }
  }

  return memoryUsers.find((u) => u.id === id) || null;
}

async function createUser(data) {
  await ensureUsersSeeded();
  const cleanEmail = data.email.trim().toLowerCase();

  if (getIsMongoConnected()) {
    const doc = await UserModel.create({ ...data, email: cleanEmail });
    return {
      id: String(doc._id),
      name: doc.name,
      email: doc.email,
      passwordHash: doc.passwordHash,
      tier: doc.tier,
    };
  }

  const newUser = {
    ...data,
    id: `usr_${Date.now()}`,
    email: cleanEmail,
  };
  memoryUsers.push(newUser);
  return newUser;
}

async function updateUserTier(userId, tier) {
  await ensureUsersSeeded();

  if (getIsMongoConnected() && mongoose.Types.ObjectId.isValid(userId)) {
    const doc = await UserModel.findByIdAndUpdate(userId, { tier }, { new: true }).lean();
    if (doc) {
      return {
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        passwordHash: doc.passwordHash,
        tier: doc.tier,
      };
    }
  }

  const user = memoryUsers.find((u) => u.id === userId);
  if (!user) return null;
  user.tier = tier;
  return user;
}

module.exports = {
  ensureUsersSeeded,
  findUserByEmail,
  findUserById,
  createUser,
  updateUserTier,
};