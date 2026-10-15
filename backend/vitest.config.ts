import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:8080',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/medicare-test-placeholder',
      BCRYPT_ROUNDS: '4',
      LOGIN_RATE_LIMIT_MAX: '1000',
    },
  },
});
