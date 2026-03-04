const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.LOGIN_RATE_LIMIT_MAX = '100';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';

const app = require('../server');
const User = require('../models/User');
const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');

let mongoServer;
let authToken;
let userId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  // Create a test user and get token
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test123',
    });

  authToken = res.body.data.accessToken;
  userId = res.body.data.user._id;
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

const sampleContact = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  company: 'Acme Corp',
  status: 'Lead',
  notes: 'Important lead from conference',
};

describe('Contact Controller', () => {
  // ==================== CREATE TESTS ====================
  describe('POST /api/contacts', () => {
    it('should create a new contact', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.contact.name).toBe(sampleContact.name);
      expect(res.body.data.contact.email).toBe(sampleContact.email);
      expect(res.body.data.contact.status).toBe('Lead');
    });

    it('should not create contact without auth', async () => {
      await request(app)
        .post('/api/contacts')
        .send(sampleContact)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should not create duplicate contact email for same user', async () => {
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should create an activity log on contact creation', async () => {
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      const logs = await ActivityLog.find({ user: userId });
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].contactName).toBe(sampleContact.name);
    });
  });

  // ==================== GET ALL TESTS ====================
  describe('GET /api/contacts', () => {
    beforeEach(async () => {
      // Create multiple contacts
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...sampleContact,
            name: `Contact ${i}`,
            email: `contact${i}@example.com`,
            status: i < 5 ? 'Lead' : i < 10 ? 'Prospect' : 'Customer',
          });
      }
    });

    it('should return paginated contacts', async () => {
      const res = await request(app)
        .get('/api/contacts?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.contacts.length).toBe(10);
      expect(res.body.data.pagination.total).toBe(15);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    it('should return second page', async () => {
      const res = await request(app)
        .get('/api/contacts?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.contacts.length).toBe(5);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/contacts?status=Lead')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.contacts.length).toBe(5);
      res.body.data.contacts.forEach((contact) => {
        expect(contact.status).toBe('Lead');
      });
    });

    it('should search by name', async () => {
      const res = await request(app)
        .get('/api/contacts?search=Contact 1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.contacts.length).toBeGreaterThan(0);
    });

    it('should search by email', async () => {
      const res = await request(app)
        .get('/api/contacts?search=contact5@example.com')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.contacts.length).toBe(1);
    });
  });

  // ==================== GET SINGLE TESTS ====================
  describe('GET /api/contacts/:id', () => {
    it('should return a single contact', async () => {
      const createRes = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      const contactId = createRes.body.data.contact._id;

      const res = await request(app)
        .get(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.contact.name).toBe(sampleContact.name);
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .get('/api/contacts/invalidid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  // ==================== UPDATE TESTS ====================
  describe('PUT /api/contacts/:id', () => {
    let contactId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      contactId = res.body.data.contact._id;
    });

    it('should update a contact', async () => {
      const res = await request(app)
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Jane Doe', status: 'Customer' })
        .expect(200);

      expect(res.body.data.contact.name).toBe('Jane Doe');
      expect(res.body.data.contact.status).toBe('Customer');
    });

    it('should create activity log on update', async () => {
      await request(app)
        .put(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Jane Doe' });

      const logs = await ActivityLog.find({ action: 'UPDATE' });
      expect(logs.length).toBe(1);
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Jane Doe' })
        .expect(404);
    });
  });

  // ==================== DELETE TESTS ====================
  describe('DELETE /api/contacts/:id', () => {
    let contactId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      contactId = res.body.data.contact._id;
    });

    it('should delete a contact', async () => {
      await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should create activity log on delete', async () => {
      await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const logs = await ActivityLog.find({ action: 'DELETE' });
      expect(logs.length).toBe(1);
      expect(logs[0].contactName).toBe(sampleContact.name);
    });
  });

  // ==================== STATS TESTS ====================
  describe('GET /api/contacts/stats', () => {
    it('should return contact statistics', async () => {
      // Create contacts with different statuses
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...sampleContact, status: 'Lead' });

      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...sampleContact, email: 'john2@example.com', status: 'Customer' });

      const res = await request(app)
        .get('/api/contacts/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.stats.total).toBe(2);
      expect(res.body.data.stats.Lead).toBe(1);
      expect(res.body.data.stats.Customer).toBe(1);
    });
  });

  // ==================== CSV EXPORT TESTS ====================
  describe('GET /api/contacts/export/csv', () => {
    it('should export contacts as CSV', async () => {
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sampleContact);

      const res = await request(app)
        .get('/api/contacts/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Name,Email');
      expect(res.text).toContain(sampleContact.name);
    });

    it('should return 404 when no contacts to export', async () => {
      await request(app)
        .get('/api/contacts/export/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
