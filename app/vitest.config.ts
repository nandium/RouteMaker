import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  await createVitestConfig(),
  defineConfig({ test: { setupFiles: ['./vitest.setup.ts'] } })
);
