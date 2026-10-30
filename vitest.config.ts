import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The backend has its own Vitest setup and is run separately by
    // `npm --prefix backend test`.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
