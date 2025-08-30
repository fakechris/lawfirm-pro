# Law Firm Pro - User Management API Documentation

## Overview

This document provides comprehensive API documentation for the User Management System in Law Firm Pro. The system implements role-based access control (RBAC) with 4 core legal roles designed for Chinese law firms.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require Bearer token authentication:

```
Authorization: Bearer <access_token>
```

## Core Roles

The system supports 6 hierarchical roles:

1. **super_admin** (Level 100) - System super administrator
2. **firm_admin** (Level 90) - Law firm administrator  
3. **lead_attorney** (Level 80) - Lead attorney (主办律师)
4. **participating_attorney** (Level 70) - Participating attorney (参与律师)
5. **legal_assistant** (Level 60) - Legal assistant (律师助理)
6. **administrative_staff** (Level 50) - Administrative staff (行政人员)

## Authentication Endpoints

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "isVerified": false,
      "createdAt": "2023-01-01T00:00:00Z",
      "updatedAt": "2023-01-01T00:00:00Z"
    },
    "permissions": ["users:read", "cases:read"]
  },
  "message": "Login successful"
}
```

### Register
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "Password123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+8613800138000"
}
```

### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout
```http
POST /auth/logout
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## User Management Endpoints

### Get All Users
```http
GET /users?page=1&limit=10&isActive=true&department=litigation&search=john
```

**Required Permission:** `users:read`

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_id",
        "email": "john@example.com",
        "username": "johndoe",
        "firstName": "John",
        "lastName": "Doe",
        "isActive": true,
        "profile": {
          "title": "Senior Attorney",
          "department": "Litigation",
          "specialization": "Corporate Law"
        }
      }
    ],
    "total": 25
  }
}
```

### Create User
```http
POST /users
```

**Required Permission:** `users:create`

**Request Body:**
```json
{
  "email": "newattorney@example.com",
  "username": "newattorney",
  "password": "Password123!",
  "firstName": "Sarah",
  "lastName": "Chen",
  "phone": "+8613900139000",
  "roleIds": ["lead_attorney_role_id"],
  "profile": {
    "title": "Associate Attorney",
    "department": "Corporate",
    "specialization": "Mergers & Acquisitions",
    "licenseNumber": "沪1234567890",
    "yearsOfExperience": 5
  }
}
```

### Update User
```http
PUT /users/:id
```

**Required Permission:** `users:update`

**Request Body:**
```json
{
  "firstName": "Sarah",
  "lastName": "Wang",
  "phone": "+8613950139500",
  "isActive": true
}
```

### Delete User
```http
DELETE /users/:id
```

**Required Permission:** `users:delete`

### Get User Permissions
```http
GET /users/:id/permissions
```

**Required Permission:** `users:read`

### Add Role to User
```http
POST /users/:id/roles
```

**Required Permission:** `users:update`

**Request Body:**
```json
{
  "roleId": "role_id"
}
```

### Set User Roles
```http
PUT /users/:id/roles
```

**Required Permission:** `users:update`

**Request Body:**
```json
{
  "roleIds": ["lead_attorney_role_id", "participating_attorney_role_id"]
}
```

## User Profile Management

### Get User Profile
```http
GET /profiles/users/:userId/profile
```

**Required Permission:** `users:read` or own profile

### Create User Profile
```http
POST /profiles/users/:userId/profile
```

**Required Permission:** `users:update` or own profile

**Request Body:**
```json
{
  "title": "Senior Partner",
  "department": "Litigation",
  "specialization": "Commercial Law",
  "licenseNumber": "沪9876543210",
  "yearsOfExperience": 15,
  "bio": "Experienced litigator with focus on commercial disputes",
  "address": "123 Shanghai Street",
  "city": "Shanghai",
  "province": "Shanghai",
  "country": "China",
  "postalCode": "200000",
  "emergencyContact": "Jane Chen",
  "emergencyPhone": "+8613600136000",
  "language": "zh-CN",
  "timezone": "Asia/Shanghai",
  "notifications": {
    "email": true,
    "sms": false,
    "push": true
  }
}
```

### Update User Profile
```http
PUT /profiles/users/:userId/profile
```

**Required Permission:** `users:update` or own profile

### Get User Directory
```http
GET /profiles/directory?page=1&limit=20&department=litigation&specialization=corporate&sortBy=name&sortOrder=asc
```

**Required Permission:** `users:read`

### Search Users
```http
GET /profiles/search?department=litigation&minYearsOfExperience=5&licenseNumber=沪123
```

**Required Permission:** `users:read`

## Role and Permission Management

### Get All Roles
```http
GET /roles
```

**Required Permission:** `roles:read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role_id",
      "name": "lead_attorney",
      "displayName": "主办律师",
      "description": "Lead attorney responsible for case management",
      "isSystem": true,
      "level": 80,
      "permissions": [
        {
          "id": "permission_id",
          "name": "cases:create",
          "displayName": "创建案件",
          "resource": "cases",
          "action": "create"
        }
      ],
      "_count": {
        "users": 5
      }
    }
  ]
}
```

### Create Role
```http
POST /roles
```

**Required Permission:** `roles:create`

**Request Body:**
```json
{
  "name": "custom_role",
  "displayName": "Custom Role",
  "description": "Custom role description",
  "level": 75
}
```

### Set Role Permissions
```http
PUT /roles/:id/permissions
```

**Required Permission:** `roles:update`

**Request Body:**
```json
{
  "permissionIds": ["cases:read", "cases:update", "documents:read"]
}
```

### Get All Permissions
```http
GET /permissions
```

**Required Permission:** `permissions:read`

### Get Permissions by Resource
```http
GET /permissions/resource/cases
```

**Required Permission:** `permissions:read`

## Audit and Logging

### Get Audit Logs
```http
GET /audit?page=1&limit=10&userId=user_id&action=login&resource=auth&startDate=2023-01-01&endDate=2023-12-31
```

**Required Permission:** `system:audit`

**Response:**
```json
{
  "success": true,
  "data": {
    "auditLogs": [
      {
        "id": "log_id",
        "userId": "user_id",
        "action": "login",
        "resource": "auth",
        "metadata": {
          "method": "email_password"
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2023-01-01T10:00:00Z",
        "user": {
          "id": "user_id",
          "username": "johndoe",
          "email": "john@example.com",
          "firstName": "John",
          "lastName": "Doe"
        }
      }
    ],
    "total": 150
  }
}
```

### Get User Activity
```http
GET /audit/users/:userId/activity?limit=50
```

**Required Permission:** `system:audit` or own activity

### Get Audit Dashboard
```http
GET /audit/dashboard?startDate=2023-01-01&endDate=2023-12-31
```

**Required Permission:** `system:audit`

**Response:**
```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "action": "login",
        "count": 1250
      },
      {
        "action": "case_create",
        "count": 350
      }
    ],
    "resources": [
      {
        "resource": "cases",
        "count": 850
      },
      {
        "resource": "users",
        "count": 420
      }
    ],
    "users": [
      {
        "user": {
          "id": "user_id",
          "username": "johndoe",
          "email": "john@example.com"
        },
        "count": 245
      }
    ]
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "timestamp": "2023-01-01T10:00:00Z"
}
```

### Common Error Codes

- **400 Bad Request** - Invalid request parameters
- **401 Unauthorized** - Authentication required or invalid
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error

## Rate Limiting

- **100 requests per 15 minutes** per IP address
- Authentication endpoints have stricter limits

## Security Features

1. **JWT Authentication** - Bearer token-based authentication
2. **Role-Based Access Control** - Hierarchical permission system
3. **Password Security** - bcrypt hashing with salt rounds
4. **Rate Limiting** - Prevents brute force attacks
5. **Audit Logging** - Comprehensive activity tracking
6. **Session Management** - Secure token refresh and revocation
7. **Input Validation** - Request body validation
8. **CORS Protection** - Cross-origin resource sharing controls

## Chinese Law Firm Specific Features

### Role Hierarchy
- **主办律师 (Lead Attorney)** - Case management and team leadership
- **参与律师 (Participating Attorney)** - Case execution and support
- **律师助理 (Legal Assistant)** - Document preparation and research
- **行政/档案人员 (Administrative Staff)** - Administrative tasks

### Specialization Support
- 劳动争议 (Labor Disputes)
- 医疗纠纷 (Medical Malpractice)  
- 刑事辩护 (Criminal Defense)
- 离婚家事 (Divorce & Family Law)
- 继承纠纷 (Inheritance Disputes)
- 合同纠纷 (Contract Disputes)
- 行政诉讼 (Administrative Cases)
- 拆迁类案件 (Demolition Cases)

## Example Usage

### 1. Initialize System
```bash
curl -X POST http://localhost:3000/api/auth/initialize \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Create Lead Attorney
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "zhang.wei@lawfirm.com",
    "username": "zhangwei",
    "password": "Password123!",
    "firstName": "张",
    "lastName": "伟",
    "roleIds": ["lead_attorney_role_id"],
    "profile": {
      "title": "高级合伙人",
      "department": "诉讼部",
      "specialization": "商事诉讼",
      "licenseNumber": "沪1234567890",
      "yearsOfExperience": 12
    }
  }'
```

### 3. Login as User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "zhang.wei@lawfirm.com",
    "password": "Password123!"
  }'
```

### 4. Get User Directory
```bash
curl -X GET "http://localhost:3000/api/profiles/directory?department=诉讼部&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

This API provides a comprehensive user management system specifically designed for Chinese law firms, with proper role hierarchy, audit logging, and security features.