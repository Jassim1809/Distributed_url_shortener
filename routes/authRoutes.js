const express = require('express');
const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateSubscriptionTier,
} = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authenticateJWT, getCurrentUser);
router.patch('/tier', authenticateJWT, updateSubscriptionTier);

module.exports = router;