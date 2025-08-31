import { Router } from 'express';
import { UserProfileController } from '../controllers/UserProfileController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// All profile routes require authentication
router.use(AuthMiddleware.authenticate);

// Profile CRUD operations
router.get('/users/:userId/profile', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getProfileByUserId
);

router.get('/users/:userId/full-profile', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getFullProfileByUserId
);

router.post('/users/:userId/profile', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.createProfile
);

router.put('/users/:userId/profile', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateProfile
);

router.delete('/users/:userId/profile', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.deleteProfile
);

// Profile information by category
router.get('/users/:userId/professional-info', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getProfessionalInfo
);

router.put('/users/:userId/professional-info', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateProfessionalInfo
);

router.get('/users/:userId/contact-info', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getContactInfo
);

router.put('/users/:userId/contact-info', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateContactInfo
);

router.get('/users/:userId/emergency-contact', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getEmergencyContact
);

router.put('/users/:userId/emergency-contact', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateEmergencyContact
);

// User preferences
router.get('/users/:userId/preferences', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getUserPreferences
);

router.put('/users/:userId/preferences', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateUserPreferences
);

router.get('/users/:userId/notifications', 
  AuthMiddleware.requireOwnershipOrPermission('users:read', (req) => req.params.userId),
  UserProfileController.getNotificationPreferences
);

router.put('/users/:userId/notifications', 
  AuthMiddleware.requireOwnershipOrPermission('users:update', (req) => req.params.userId),
  UserProfileController.updateNotificationPreferences
);

// Directory and search (require read permission)
router.get('/directory', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.getUserDirectory
);

router.get('/search', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.searchUsers
);

// Statistics (require read permission)
router.get('/departments/stats', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.getDepartmentStats
);

router.get('/specializations/stats', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.getSpecializationStats
);

router.get('/departments/:department', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.getProfilesByDepartment
);

router.get('/specializations/:specialization', 
  AuthMiddleware.requirePermission('users:read'),
  UserProfileController.getProfilesBySpecialization
);

export default router;