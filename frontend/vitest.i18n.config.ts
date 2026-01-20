// vitest.i18n.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/i18n.json.test.ts'],
    coverage: {
      enabled: false, // key point: don't enforce thresholds here
    },
  },
});
