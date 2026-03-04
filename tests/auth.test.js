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

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth Controller', () => {
  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Test123',
  };

  // ==================== SIGNUP TESTS ====================
  describe('POST /api/auth/signup', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe(validUser.name);
      expect(res.body.data.user.email).toBe(validUser.email);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should not register user with existing email', async () => {
      await request(app).post('/api/auth/signup').send(validUser);

      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, email: 'invalid-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, password: '123' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== SIGNIN TESTS ====================
  describe('POST /api/auth/signin', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: validUser.email,
          password: validUser.password,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(validUser.email);
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: validUser.email,
          password: 'WrongPassword1',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET ME TESTS ====================
  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      const token = signupRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUser.email);
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== REFRESH TOKEN TESTS ====================
  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      // Extract refresh token from cookies
      const cookies = signupRes.headers['set-cookie'];
      
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies || [])
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject refresh without token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ==================== LOGOUT TESTS ====================
  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      const token = signupRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});
