import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';

describe('Auth Middleware & Security (auth.js)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test_jwt_secret_key_12345' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('rejects requests with missing Authorization header', () => {
    const req = { headers: {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentication required. No token provided.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects requests with non-Bearer authorization format', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects invalid or forged JWT tokens', () => {
    const req = { headers: { authorization: 'Bearer invalid.jwt.token' } };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid JWT token and attaches req.userId', () => {
    const testUserId = '64f1234567890abcdef12345';
    const validToken = jwt.sign({ userId: testUserId }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe(testUserId);
    expect(req.user.userId).toBe(testUserId);
  });

  test('bcrypt securely hashes and validates passwords', async () => {
    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const matchesCorrect = await bcrypt.compare(rawPassword, hash);
    const matchesIncorrect = await bcrypt.compare('WrongPassword', hash);

    expect(matchesCorrect).toBe(true);
    expect(matchesIncorrect).toBe(false);
  });
});
