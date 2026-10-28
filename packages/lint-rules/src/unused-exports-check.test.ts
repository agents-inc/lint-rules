import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readManifest } from './__tests__/package-manifests.ts'

type TurboConfig = { readonly tasks: Readonly<Record<string, unknown>> }

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const ROOT_MANIFEST = readManifest(join(REPO_ROOT, 'package.json'))
// Parse boundary: the repo's turbo.json.
const TURBO_CONFIG = JSON.parse(readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')) as TurboConfig
const UNUSED_EXPORTS_SCRIPT = 'unused-exports'
// turbo names a script of the root package.json `//#<script>`.
const UNUSED_EXPORTS_TASK = `//#${UNUSED_EXPORTS_SCRIPT}`
const TYPECHECK_SCRIPTS_TASK = '//#typecheck-scripts'
// The root's lint configs, which typecheck-scripts checks, read @agents-inc/lint-rules' types from its dist.
const LINT_RULES_BUILD_TASK = '@agents-inc/lint-rules#build'

describe('the check for exports nothing imports', () => {
  it('is knip, run as the root script unused-exports', () => {
    expect(ROOT_MANIFEST.scripts).toHaveProperty(UNUSED_EXPORTS_SCRIPT, 'knip')
  })

  it("runs before each package's typecheck, so a finding fails it", () => {
    expect(TURBO_CONFIG.tasks['typecheck']).toStrictEqual({ dependsOn: ['^typecheck', '^build', UNUSED_EXPORTS_TASK] })
  })

  it("runs before the typecheck of scripts/ and the root's lint configs, which also waits for lint-rules' build", () => {
    expect(TURBO_CONFIG.tasks[TYPECHECK_SCRIPTS_TASK]).toStrictEqual({ dependsOn: [UNUSED_EXPORTS_TASK, LINT_RULES_BUILD_TASK], cache: false })
  })

  it("runs every time, never replayed from turbo's cache", () => {
    expect(TURBO_CONFIG.tasks[UNUSED_EXPORTS_TASK]).toStrictEqual({ cache: false })
  })
})
