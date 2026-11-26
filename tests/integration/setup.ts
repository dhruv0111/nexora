import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('nexora_phase1'))
  throw new Error(
    'Use the isolated nexora_phase1 database for integration tests.',
  );
process.env.DATABASE_URL = url;
