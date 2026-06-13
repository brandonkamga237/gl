import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/services/**/*.js',
        'src/controllers/**/*.js',
        'src/middlewares/**/*.js',
      ],
      exclude: ['node_modules/**', 'tests/**', 'src/server.js'],
    },
    testTimeout: 30000,
    forceRerunTriggers: [],
  },
});
