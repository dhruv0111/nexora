import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/database.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
