const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const User = require('../models/User');
const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterEach(async () => {
  await User.deleteMany({});
  await Contact.deleteMany({});
  await ActivityLog.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('User Model', () => {
  const validUserData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Test123',
  };

  it('should create a user successfully', async () => {
    const user = new User(validUserData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(validUserData.name);
    expect(savedUser.email).toBe(validUserData.email);
    expect(savedUser.role).toBe('user');
  });

  it('should hash the password before saving', async () => {
    const user = new User(validUserData);
    const savedUser = await user.save();

    // Fetch with password
    const userWithPassword = await User.findById(savedUser._id).select('+password');
    expect(userWithPassword.password).not.toBe(validUserData.password);
  });

  it('should compare passwords correctly', async () => {
    const user = new User(validUserData);
    await user.save();

    const userWithPassword = await User.findById(user._id).select('+password');
    const isMatch = await userWithPassword.comparePassword(validUserData.password);
    expect(isMatch).toBe(true);

    const isWrongMatch = await userWithPassword.comparePassword('wrongpassword');
    expect(isWrongMatch).toBe(false);
  });

  it('should require name', async () => {
    const user = new User({ email: 'test@example.com', password: 'Test123' });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('should require email', async () => {
    const user = new User({ name: 'Test', password: 'Test123' });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  it('should not allow duplicate emails', async () => {
    await new User(validUserData).save();
    let err;
    try {
      await new User(validUserData).save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('should validate email format', async () => {
    const user = new User({ ...validUserData, email: 'invalid' });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
  });
});

describe('Contact Model', () => {
  let userId;

  beforeEach(async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test123',
    });
    const savedUser = await user.save();
    userId = savedUser._id;
  });

  const getContactData = (overrides = {}) => ({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    company: 'Acme Corp',
    status: 'Lead',
    notes: 'Some notes',
    user: userId,
    ...overrides,
  });

  it('should create a contact successfully', async () => {
    const contact = new Contact(getContactData());
    const saved = await contact.save();

    expect(saved._id).toBeDefined();
    expect(saved.name).toBe('John Doe');
    expect(saved.status).toBe('Lead');
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });

  it('should require name and email', async () => {
    const contact = new Contact({ user: userId });
    let err;
    try {
      await contact.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  it('should validate status values', async () => {
    const contact = new Contact(getContactData({ status: 'Invalid' }));
    let err;
    try {
      await contact.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  it('should default status to Lead', async () => {
    const data = getContactData();
    delete data.status;
    const contact = new Contact(data);
    const saved = await contact.save();
    expect(saved.status).toBe('Lead');
  });
});

describe('ActivityLog Model', () => {
  let userId;

  beforeEach(async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test123',
    });
    const savedUser = await user.save();
    userId = savedUser._id;
  });

  it('should create an activity log', async () => {
    const log = await ActivityLog.logActivity({
      user: userId,
      action: 'CREATE',
      entityId: new mongoose.Types.ObjectId(),
      contactName: 'John Doe',
      details: 'Created contact John Doe',
    });

    expect(log._id).toBeDefined();
    expect(log.action).toBe('CREATE');
    expect(log.contactName).toBe('John Doe');
  });

  it('should validate action values', async () => {
    const log = new ActivityLog({
      user: userId,
      action: 'INVALID',
      contactName: 'Test',
    });

    let err;
    try {
      await log.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
  });
});
