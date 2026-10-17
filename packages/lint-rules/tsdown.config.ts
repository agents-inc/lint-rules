import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    oxlint: 'src/oxlint.ts',
    eslint: 'src/eslint.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22.18',
  // Without eager, re-exported types from the TS-source @workspace packages fail with MISSING_EXPORT.
  dts: { eager: true },
  // The @workspace packages are never published, so they are always inlined.
  deps: { alwaysBundle: [/^@workspace\//] },
})
