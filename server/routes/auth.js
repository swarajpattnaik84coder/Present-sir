import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper to generate JWT token for a user
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is missing from environment variables');
  }
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

/**
 * Format user object to safely exclude passwordHash
 */
const formatUserResponse = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.passwordHash;
  delete userObj.__v;
  return userObj;
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      collegeId,
      department,
      semester,
      section,
      targetPercent,
      semesterStartDate,
      semesterEndDate,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        error: 'An account with this email already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      collegeId: collegeId || '',
      department: department || '',
      semester: semester || 1,
      section: section || '',
      targetPercent: targetPercent || 75,
      semesterStartDate: semesterStartDate ? new Date(semesterStartDate) : null,
      semesterEndDate: semesterEndDate ? new Date(semesterEndDate) : null,
    });

    const token = generateToken(newUser._id);

    return res.status(201).json({
      token,
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Registration failed. Please try again.',
    });
  }
});

/**
 * POST /api/auth/login
 * Log in an existing user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Login failed. Please try again.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -__v');
    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return res.status(500).json({
      error: 'Failed to fetch user profile.',
    });
  }
});

export default router;
