import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('CI/CD Pipeline Tests', () => {
  const testDir = path.join(__dirname, '../../..');
  
  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.CI = 'true';
  });

  describe('Docker Configuration', () => {
    it('should have Dockerfile in correct location', () => {
      const dockerfilePath = path.join(testDir, 'docker', 'Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    it('should have production Dockerfile with multi-stage build', () => {
      const dockerfilePath = path.join(testDir, 'docker', 'Dockerfile');
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      
      expect(dockerfileContent).toContain('AS builder');
      expect(dockerfileContent).toContain('AS production');
      expect(dockerfileContent).toContain('COPY --from=builder');
    });

    it('should have development Dockerfile', () => {
      const devDockerfilePath = path.join(testDir, 'docker', 'Dockerfile.dev');
      expect(fs.existsSync(devDockerfilePath)).toBe(true);
    });

    it('should have Docker Compose files', () => {
      const composePath = path.join(testDir, 'docker', 'docker-compose.yml');
      const prodComposePath = path.join(testDir, 'docker', 'docker-compose.prod.yml');
      
      expect(fs.existsSync(composePath)).toBe(true);
      expect(fs.existsSync(prodComposePath)).toBe(true);
    });

    it('should have .dockerignore file', () => {
      const dockerignorePath = path.join(testDir, '.dockerignore');
      expect(fs.existsSync(dockerignorePath)).toBe(true);
      
      const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf8');
      expect(dockerignoreContent).toContain('node_modules');
      expect(dockerignoreContent).toContain('.env');
      expect(dockerignoreContent).toContain('.git');
    });
  });

  describe('GitHub Actions Workflows', () => {
    it('should have workflows directory', () => {
      const workflowsPath = path.join(testDir, '.github', 'workflows');
      expect(fs.existsSync(workflowsPath)).toBe(true);
    });

    it('should have main CI/CD workflow', () => {
      const workflowPath = path.join(testDir, '.github', 'workflows', 'ci-cd.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);
      
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowContent).toContain('name: CI/CD Pipeline');
      expect(workflowContent).toContain('on:');
      expect(workflowContent).toContain('jobs:');
    });

    it('should have scheduled tasks workflow', () => {
      const workflowPath = path.join(testDir, '.github', 'workflows', 'scheduled-tasks.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);
      
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowContent).toContain('name: Scheduled Tasks & Monitoring');
      expect(workflowContent).toContain('schedule:');
    });

    it('should have quality gates workflow', () => {
      const workflowPath = path.join(testDir, '.github', 'workflows', 'quality-gates.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);
      
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      expect(workflowContent).toContain('name: Quality Gates & Code Review');
      expect(workflowContent).toContain('pull_request:');
    });
  });

  describe('Deployment Scripts', () => {
    it('should have deployment scripts directory', () => {
      const scriptsPath = path.join(testDir, 'scripts', 'deployment');
      expect(fs.existsSync(scriptsPath)).toBe(true);
    });

    it('should have main deployment script', () => {
      const scriptPath = path.join(testDir, 'scripts', 'deployment', 'deploy.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('#!/bin/bash');
      expect(scriptContent).toContain('kubectl');
      expect(scriptContent).toContain('ENVIRONMENT');
    });

    it('should have blue-green deployment script', () => {
      const scriptPath = path.join(testDir, 'scripts', 'deployment', 'deploy-blue-green.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('blue-green');
      expect(scriptContent).toContain('CURRENT_COLOR');
      expect(scriptContent).toContain('INACTIVE_COLOR');
    });

    it('should have health check script', () => {
      const scriptPath = path.join(testDir, 'scripts', 'deployment', 'health-check.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('health-check');
      expect(scriptContent).toContain('curl');
      expect(scriptContent).toContain('HTTP_CODE');
    });

    it('should have rollback script', () => {
      const scriptPath = path.join(testDir, 'scripts', 'deployment', 'rollback.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('rollback');
      expect(scriptContent).toContain('rollout undo');
    });

    it('should have backup script', () => {
      const scriptPath = path.join(testDir, 'scripts', 'deployment', 'backup.sh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('backup');
      expect(scriptContent).toContain('pg_dump');
      expect(scriptContent).toContain('aws s3');
    });
  });

  describe('CI Tests', () => {
    it('should have CI tests directory', () => {
      const ciTestsPath = path.join(testDir, 'tests', 'ci');
      expect(fs.existsSync(ciTestsPath)).toBe(true);
    });

    it('should be able to run npm install in CI mode', () => {
      try {
        execSync('npm ci', { 
          cwd: testDir,
          env: { ...process.env, CI: 'true' },
          stdio: 'pipe'
        });
        expect(true).toBe(true);
      } catch (error) {
        console.error('npm ci failed:', (error as Error).message);
        expect(false).toBe(true);
      }
    });

    it('should be able to run type checking', () => {
      try {
        execSync('npx tsc --noEmit', { 
          cwd: testDir,
          env: { ...process.env, CI: 'true' },
          stdio: 'pipe'
        });
        expect(true).toBe(true);
      } catch (error) {
        console.error('Type checking failed:', (error as Error).message);
        expect(false).toBe(true);
      }
    });

    it('should be able to run linting', () => {
      try {
        execSync('npm run lint', { 
          cwd: testDir,
          env: { ...process.env, CI: 'true' },
          stdio: 'pipe'
        });
        expect(true).toBe(true);
      } catch (error) {
        console.error('Linting failed:', (error as Error).message);
        expect(false).toBe(true);
      }
    });
  });

  describe('Environment Configuration', () => {
    it('should have configuration for multiple environments', () => {
      const configPath = path.join(testDir, 'config');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should have proper package.json scripts for CI/CD', () => {
      const packageJsonPath = path.join(testDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('lint');
      expect(packageJson.scripts).toHaveProperty('db:generate');
      expect(packageJson.scripts).toHaveProperty('db:migrate');
    });

    it('should have proper Node.js version requirement', () => {
      const packageJsonPath = path.join(testDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      expect(packageJson.engines).toHaveProperty('node');
      expect(packageJson.engines.node).toBe('>=18.0.0');
    });
  });

  describe('Security Configuration', () => {
    it('should have security scanning in CI workflow', () => {
      const workflowPath = path.join(testDir, '.github', 'workflows', 'ci-cd.yml');
      const workflowContent = fs.readFileSync(workflowPath, 'utf8');
      
      expect(workflowContent).toContain('security-scan');
      expect(workflowContent).toContain('npm audit');
      expect(workflowContent).toContain('snyk');
    });

    it('should have proper health checks in Docker configuration', () => {
      const dockerfilePath = path.join(testDir, 'docker', 'Dockerfile');
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      
      expect(dockerfileContent).toContain('HEALTHCHECK');
      expect(dockerfileContent).toContain('curl -f http://localhost:3000/health');
    });

    it('should have non-root user in Docker configuration', () => {
      const dockerfilePath = path.join(testDir, 'docker', 'Dockerfile');
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      
      expect(dockerfileContent).toContain('USER lawfirm');
    });
  });

  describe('Monitoring and Observability', () => {
    it('should have monitoring configuration in production compose', () => {
      const composePath = path.join(testDir, 'docker', 'docker-compose.prod.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');
      
      expect(composeContent).toContain('prometheus');
      expect(composeContent).toContain('grafana');
      expect(composeContent).toContain('nginx');
    });

    it('should have proper resource limits in production configuration', () => {
      const composePath = path.join(testDir, 'docker', 'docker-compose.prod.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');
      
      expect(composeContent).toContain('resources:');
      expect(composeContent).toContain('limits:');
      expect(composeContent).toContain('reservations:');
    });
  });

  afterAll(() => {
    // Clean up test environment
    delete process.env.CI;
  });
});