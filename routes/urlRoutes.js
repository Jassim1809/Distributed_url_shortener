const express = require('express');
const {
  shortenUrl,
  listUrls,
  deleteUrl,
  resolveUrl,
  redirectUrl,
} = require('../controllers/urlController');
const { authenticateJWT, enforceTierPolicy } = require('../middleware/authMiddleware');

const router = express.Router();

// Write & Management Routes
router.get('/api/urls', listUrls);
router.post('/api/urls', authenticateJWT, enforceTierPolicy, shortenUrl);
router.delete('/api/urls/:code', authenticateJWT, deleteUrl);

// Read & Redirect Routes
router.get('/api/urls/resolve/:code', resolveUrl);
router.get('/s/:code', redirectUrl);

module.exports = router;