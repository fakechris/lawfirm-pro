import { Router } from 'express';
import { z } from 'zod';
import { Database } from '../utils/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const updateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
});

const createClientProfileSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
});

const createAttorneyProfileSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  experience: z.number().min(0).optional(),
  bio: z.string().optional(),
});

// Get all users (admin only)
router.get('/', authenticate, authorize(['ADMIN']), asyncHandler(async (req: AuthRequest, res) => {
  const db = new Database();
  await db.connect();

  const users = await db.client.user.findMany({
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
    orderBy: { createdAt: 'desc' },
  });

  await db.disconnect();

  res.json({
    success: true,
    data: { users },
  });
}));

// Get user by ID
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Users can only access their own profile unless they're admin
  if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
    throw createError('Access denied', 403);
  }

  const db = new Database();
  await db.connect();

  const user = await db.client.user.findUnique({
    where: { id },
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
}));

// Update user
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = updateUserSchema.parse(req.body);

  // Users can only update their own profile unless they're admin
  if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
    throw createError('Access denied', 403);
  }

  const db = new Database();
  await db.connect();

  // Check if user exists
  const existingUser = await db.client.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    await db.disconnect();
    throw createError('User not found', 404);
  }

  // If updating email, check if it's already taken
  if (validatedData.email && validatedData.email !== existingUser.email) {
    const emailExists = await db.client.user.findUnique({
      where: { email: validatedData.email },
    });

    if (emailExists) {
      await db.disconnect();
      throw createError('Email already taken', 409);
    }
  }

  const user = await db.client.user.update({
    where: { id },
    data: validatedData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user },
  });
}));

// Create client profile
router.post('/:id/client-profile', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = createClientProfileSchema.parse(req.body);

  // Users can only create their own profile unless they're admin
  if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
    throw createError('Access denied', 403);
  }

  const db = new Database();
  await db.connect();

  // Check if user exists and is a client
  const user = await db.client.user.findUnique({
    where: { id },
  });

  if (!user) {
    await db.disconnect();
    throw createError('User not found', 404);
  }

  if (user.role !== 'CLIENT') {
    await db.disconnect();
    throw createError('Only clients can have client profiles', 400);
  }

  // Check if profile already exists
  const existingProfile = await db.client.clientProfile.findUnique({
    where: { userId: id },
  });

  if (existingProfile) {
    await db.disconnect();
    throw createError('Client profile already exists', 409);
  }

  const profile = await db.client.clientProfile.create({
    data: {
      userId: id,
      ...validatedData,
    },
  });

  await db.disconnect();

  res.status(201).json({
    success: true,
    message: 'Client profile created successfully',
    data: { profile },
  });
}));

// Create attorney profile
router.post('/:id/attorney-profile', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = createAttorneyProfileSchema.parse(req.body);

  // Users can only create their own profile unless they're admin
  if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
    throw createError('Access denied', 403);
  }

  const db = new Database();
  await db.connect();

  // Check if user exists and is an attorney
  const user = await db.client.user.findUnique({
    where: { id },
  });

  if (!user) {
    await db.disconnect();
    throw createError('User not found', 404);
  }

  if (user.role !== 'ATTORNEY') {
    await db.disconnect();
    throw createError('Only attorneys can have attorney profiles', 400);
  }

  // Check if profile already exists
  const existingProfile = await db.client.attorneyProfile.findUnique({
    where: { userId: id },
  });

  if (existingProfile) {
    await db.disconnect();
    throw createError('Attorney profile already exists', 409);
  }

  const profile = await db.client.attorneyProfile.create({
    data: {
      userId: id,
      ...validatedData,
    },
  });

  await db.disconnect();

  res.status(201).json({
    success: true,
    message: 'Attorney profile created successfully',
    data: { profile },
  });
}));

// Delete user (admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  // Check if user exists
  const user = await db.client.user.findUnique({
    where: { id },
  });

  if (!user) {
    await db.disconnect();
    throw createError('User not found', 404);
  }

  // Delete user (cascade will handle related records)
  await db.client.user.delete({
    where: { id },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
}));

export default router;