const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');
const { ApiError } = require('../middleware/errorHandler');

/**
 * @desc    Get all contacts with pagination, search, and filter
 * @route   GET /api/contacts
 * @access  Private
 */
const getContacts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = { user: req.user.userId };

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by status
    if (status && ['Lead', 'Prospect', 'Customer'].includes(status)) {
      query.status = status;
    }

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
      lean: true,
    };

    const result = await Contact.paginate(query, options);

    res.status(200).json({
      success: true,
      data: {
        contacts: result.docs,
        pagination: {
          total: result.totalDocs,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
          nextPage: result.nextPage,
          prevPage: result.prevPage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single contact by ID
 * @route   GET /api/contacts/:id
 * @access  Private
 */
const getContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!contact) {
      throw new ApiError(404, 'Contact not found');
    }

    res.status(200).json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new contact
 * @route   POST /api/contacts
 * @access  Private
 */
const createContact = async (req, res, next) => {
  try {
    const { name, email, phone, company, status, notes } = req.body;

    // Check if contact with same email exists for this user
    const existingContact = await Contact.findOne({
      email,
      user: req.user.userId,
    });

    if (existingContact) {
      throw new ApiError(409, 'A contact with this email already exists');
    }

    const contact = new Contact({
      name,
      email,
      phone: phone || '',
      company: company || '',
      status: status || 'Lead',
      notes: notes || '',
      user: req.user.userId,
    });

    await contact.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'CREATE',
      entityId: contact._id,
      contactName: contact.name,
      details: `Created contact "${contact.name}" (${contact.email})`,
    });

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      data: { contact },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a contact
 * @route   PUT /api/contacts/:id
 * @access  Private
 */
const updateContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!contact) {
      throw new ApiError(404, 'Contact not found');
    }

    // Track changes for activity log
    const changes = {};
    const allowedFields = ['name', 'email', 'phone', 'company', 'status', 'notes'];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== contact[field]) {
        changes[field] = {
          from: contact[field],
          to: req.body[field],
        };
      }
    });

    // Check for duplicate email if email is being changed
    if (req.body.email && req.body.email !== contact.email) {
      const existingContact = await Contact.findOne({
        email: req.body.email,
        user: req.user.userId,
        _id: { $ne: contact._id },
      });

      if (existingContact) {
        throw new ApiError(409, 'A contact with this email already exists');
      }
    }

    // Update fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        contact[field] = req.body[field];
      }
    });

    await contact.save();

    // Log activity if there were changes
    if (Object.keys(changes).length > 0) {
      const changedFields = Object.keys(changes).join(', ');
      await ActivityLog.logActivity({
        user: req.user.userId,
        action: 'UPDATE',
        entityId: contact._id,
        contactName: contact.name,
        details: `Updated ${changedFields} for contact "${contact.name}"`,
        changes,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: { contact },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a contact
 * @route   DELETE /api/contacts/:id
 * @access  Private
 */
const deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!contact) {
      throw new ApiError(404, 'Contact not found');
    }

    const contactName = contact.name;
    const contactEmail = contact.email;

    await Contact.deleteOne({ _id: contact._id });

    // Log activity
    await ActivityLog.logActivity({
      user: req.user.userId,
      action: 'DELETE',
      entityId: contact._id,
      contactName,
      details: `Deleted contact "${contactName}" (${contactEmail})`,
    });

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export contacts as CSV
 * @route   GET /api/contacts/export/csv
 * @access  Private
 */
const exportContactsCSV = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { user: req.user.userId };

    if (status && ['Lead', 'Prospect', 'Customer'].includes(status)) {
      query.status = status;
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (contacts.length === 0) {
      throw new ApiError(404, 'No contacts found to export');
    }

    // Build CSV
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Notes', 'Created At', 'Updated At'];
    const csvRows = [headers.join(',')];

    contacts.forEach((contact) => {
      const row = [
        `"${(contact.name || '').replace(/"/g, '""')}"`,
        `"${(contact.email || '').replace(/"/g, '""')}"`,
        `"${(contact.phone || '').replace(/"/g, '""')}"`,
        `"${(contact.company || '').replace(/"/g, '""')}"`,
        `"${contact.status}"`,
        `"${(contact.notes || '').replace(/"/g, '""')}"`,
        `"${new Date(contact.createdAt).toISOString()}"`,
        `"${new Date(contact.updatedAt).toISOString()}"`,
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contacts_${Date.now()}.csv`
    );

    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get contact statistics
 * @route   GET /api/contacts/stats
 * @access  Private
 */
const getContactStats = async (req, res, next) => {
  try {
    const stats = await Contact.aggregate([
      { $match: { user: req.user.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalContacts = await Contact.countDocuments({ user: req.user.userId });

    const formattedStats = {
      total: totalContacts,
      Lead: 0,
      Prospect: 0,
      Customer: 0,
    };

    stats.forEach((stat) => {
      formattedStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: { stats: formattedStats },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  exportContactsCSV,
  getContactStats,
};
