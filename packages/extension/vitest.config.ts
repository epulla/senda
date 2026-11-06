import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({ plugins: [WxtVitest()], test: { setupFiles: ['tests/setup.ts'], passWithNoTests: true, exclude: ['e2e/**', '**/node_modules/**'] } });
