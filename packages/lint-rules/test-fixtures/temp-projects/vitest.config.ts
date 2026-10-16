import { defineConfig } from 'vitest/config'
import packageConfig from '../../vitest.config.ts'

// The package's own test settings, running these files alone, from this folder. Each is a test file
// that makes a temp project, names it in a test's title or its error, and then ends one way a test
// file can end.
export default defineConfig({ test: { ...packageConfig.test, include: ['*.fixture.ts'] } })
