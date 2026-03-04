const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
      match: [
        /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]*$/,
        'Please provide a valid phone number',
      ],
      default: '',
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['Lead', 'Prospect', 'Customer'],
        message: 'Status must be Lead, Prospect, or Customer',
      },
      default: 'Lead',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for unique email per user
contactSchema.index({ email: 1, user: 1 }, { unique: true });

// Index for search and filtering
contactSchema.index({ name: 'text', email: 'text' });
contactSchema.index({ status: 1, user: 1 });
contactSchema.index({ createdAt: -1 });

// Apply pagination plugin
contactSchema.plugin(mongoosePaginate);

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
