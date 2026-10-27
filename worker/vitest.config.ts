import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.toml' },
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations('migrations') },
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['test/setup.ts'] },
}));
