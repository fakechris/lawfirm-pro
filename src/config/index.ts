import dotenv from 'dotenv';
import { integrationConfig } from './integration';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  
  storage: {
    basePath: process.env.STORAGE_BASE_PATH || './storage',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'audio/mp3',
      'audio/wav',
      'video/mp4',
      'video/avi',
      'text/plain',
      'text/csv'
    ],
    paths: {
      documents: {
        original: 'documents/original',
        versions: 'documents/versions',
        processed: 'documents/processed'
      },
      templates: {
        active: 'templates/active',
        archive: 'templates/archive'
      },
      evidence: {
        original: 'evidence/original',
        thumbnails: 'evidence/thumbnails',
        processed: 'evidence/processed'
      },
      temp: {
        uploads: 'temp/uploads'
      }
    }
  },
  
  ocr: {
    enabled: process.env.OCR_ENABLED === 'true',
    language: process.env.OCR_LANGUAGE || 'chi_sim+eng',
    timeout: parseInt(process.env.OCR_TIMEOUT || '30000')
  },
  
  search: {
    minContentLength: parseInt(process.env.SEARCH_MIN_CONTENT_LENGTH || '50'),
    maxContentLength: parseInt(process.env.SEARCH_MAX_CONTENT_LENGTH || '1000000'),
    batchSize: parseInt(process.env.SEARCH_BATCH_SIZE || '100')
  },
  
  integration: integrationConfig
};