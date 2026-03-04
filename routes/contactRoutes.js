const express = require('express');
const router = express.Router();
const {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  exportContactsCSV,
  getContactStats,
} = require('../controllers/contactController');
const { authenticate } = require('../middleware/auth');
const {
  validateContact,
  validateContactUpdate,
  validateObjectId,
  validatePagination,
} = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// Special routes (must be before /:id)
router.get('/export/csv', exportContactsCSV);
router.get('/stats', getContactStats);

// CRUD routes
router.get('/', validatePagination, getContacts);
router.get('/:id', validateObjectId, getContact);
router.post('/', validateContact, createContact);
router.put('/:id', validateObjectId, validateContactUpdate, updateContact);
router.delete('/:id', validateObjectId, deleteContact);

module.exports = router;
