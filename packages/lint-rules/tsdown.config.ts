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
  // Without eager, the declaration bundle fails on re-exported types from the TS-source
  // @workspace packages (MISSING_EXPORT); with it, their types are inlined.
  dts: { eager: true },
  // The @workspace packages are private and never published, so they must be inlined
  // whichever dependency field lists them.
  deps: { alwaysBundle: [/^@workspace\//] },
})
