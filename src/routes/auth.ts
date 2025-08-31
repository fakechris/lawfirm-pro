import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Database } from '../utils/database';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['CLIENT', 'ATTORNEY', 'ADMIN', 'ASSISTANT']).optional().default('CLIENT'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Register endpoint
router.post('/register', asyncHandler(async (req, res) => {
  const validatedData = registerSchema.parse(req.body);
  const { email, password, firstName, lastName, role } = validatedData;

  const db = new Database();
  await db.connect();

  // Check if user already exists
  const existingUser = await db.client.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    await db.disconnect();
    throw createError('User already exists', 409);
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await db.client.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  await db.disconnect();

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      token,
      refreshToken,
    },
  });
}));

// Login endpoint
router.post('/login', asyncHandler(async (req, res) => {
  const validatedData = loginSchema.parse(req.body);
  const { email, password } = validatedData;

  const db = new Database();
  await db.connect();

  // Find user
  const user = await db.client.user.findUnique({
    where: { email },
  });

  if (!user) {
    await db.disconnect();
    throw createError('Invalid credentials', 401);
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await db.disconnect();
    throw createError('Invalid credentials', 401);
  }

  await db.disconnect();

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
      refreshToken,
    },
  });
}));

// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw createError('Refresh token is required', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    
    const db = new Database();
    await db.connect();

    const user = await db.client.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    await db.disconnect();

    if (!user) {
      throw createError('Invalid refresh token', 401);
    }

    // Generate new access token
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        user,
      },
    });
  } catch (error) {
    throw createError('Invalid refresh token', 401);
  }
}));

// Get current user endpoint
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw createError('No token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const db = new Database();
    await db.connect();

    const user = await db.client.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        clientProfile: {
          select: {
            phone: true,
            address: true,
            company: true,
          },
        },
        attorneyProfile: {
          select: {
            licenseNumber: true,
            specialization: true,
            experience: true,
            bio: true,
          },
        },
      },
    });

    await db.disconnect();

    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    throw createError('Invalid token', 401);
  }
}));

export default router;