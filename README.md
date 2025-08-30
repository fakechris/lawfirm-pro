# Law Firm Pro - User Management System

A comprehensive user management system with role-based access control (RBAC) designed specifically for Chinese law firms. This system implements hierarchical roles, granular permissions, and complete audit logging for legal practice teams.

## Features

### 🎯 Core Functionality

- **Role-Based Access Control (RBAC)** - 6 hierarchical roles tailored for legal practices
- **Granular Permission System** - Fine-grained access control over all system features
- **User Profile Management** - Professional information, skills, and expertise tracking
- **JWT Authentication** - Secure token-based authentication with refresh tokens
- **Audit Logging** - Complete activity tracking with comprehensive search and filtering
- **Session Management** - Secure session handling with automatic cleanup

### 👥 Legal Practice Roles

1. **超级管理员 (Super Admin)** - Level 100 - System-wide administration
2. **律所管理员 (Firm Admin)** - Level 90 - Law firm management
3. **主办律师 (Lead Attorney)** - Level 80 - Case management and team leadership
4. **参与律师 (Participating Attorney)** - Level 70 - Case execution and support
5. **律师助理 (Legal Assistant)** - Level 60 - Document preparation and research
6. **行政人员 (Administrative Staff)** - Level 50 - Administrative tasks

### 🔐 Security Features

- **Password Hashing** - bcrypt with configurable salt rounds
- **Rate Limiting** - Prevents brute force attacks
- **Input Validation** - Comprehensive request validation
- **CORS Protection** - Cross-origin resource sharing controls
- **Helmet Security** - Security headers and protections
- **Audit Trails** - Complete user activity logging

## Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with refresh mechanism
- **Testing**: Jest with comprehensive test coverage
- **Security**: bcrypt, helmet, cors, rate limiting

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # API controllers
├── middleware/       # Authentication and authorization middleware
├── models/          # Data models and database operations
├── routes/          # API route definitions
├── services/        # Business logic services
├── test/            # Test files
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── app.ts           # Express application setup
└── index.ts         # Server entry point
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/current-user` - Get current user

### User Management
- `GET /api/users` - Get all users (with pagination/filtering)
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/:id/permissions` - Get user permissions
- `PUT /api/users/:id/roles` - Set user roles

### Role & Permission Management
- `GET /api/roles` - Get all roles
- `POST /api/roles` - Create new role
- `GET /api/permissions` - Get all permissions
- `PUT /api/roles/:id/permissions` - Set role permissions

### Profile Management
- `GET /api/profiles/users/:userId/profile` - Get user profile
- `POST /api/profiles/users/:userId/profile` - Create user profile
- `PUT /api/profiles/users/:userId/profile` - Update user profile
- `GET /api/profiles/directory` - Get user directory

### Audit & Logging
- `GET /api/audit` - Get audit logs
- `GET /api/audit/dashboard` - Get audit dashboard
- `GET /api/audit/users/:userId/activity` - Get user activity

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd lawfirmpro
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database credentials and other settings
```

4. Set up database
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate
```

5. Start the development server
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/lawfirmpro"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# bcrypt
BCRYPT_SALT_ROUNDS="12"

# Rate limiting
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX="100"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Environment
NODE_ENV="development"
PORT="3000"
```

## Testing

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test -- --coverage
```

### Database Testing

Tests use a separate test database. Make sure your `DATABASE_URL` in `.env.test` points to your test database.

## Database Schema

The system uses the following main entities:

- **Users** - Core user accounts with authentication
- **UserProfiles** - Extended user information and professional details
- **Roles** - Hierarchical role definitions
- **Permissions** - Granular permission definitions
- **AuditLogs** - Complete activity tracking
- **Sessions** - Secure session management

### Key Relationships

- Users can have multiple roles
- Roles can have multiple permissions
- Users can have direct permissions
- All activities are logged to audit trails
- Sessions are managed with refresh tokens

## Security Considerations

1. **Never commit secrets** to version control
2. **Use strong JWT secrets** in production
3. **Configure proper CORS** origins
4. **Set appropriate rate limits** for your usage
5. **Regularly rotate JWT secrets**
6. **Monitor audit logs** for suspicious activity
7. **Use HTTPS** in production
8. **Implement proper input validation**

## API Documentation

Comprehensive API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## Development

### Code Standards

- Use TypeScript strict mode
- Follow ESLint configuration
- Write comprehensive tests
- Use meaningful commit messages
- Keep functions small and focused

### Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm start           # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode

# Code quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please create an issue in the repository.

---

**Note**: This is a backend API system. For the complete Law Firm Pro application, this user management system would be integrated with case management, document management, billing, and other modules to provide a comprehensive legal practice management solution.