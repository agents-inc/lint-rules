import type { LockedWorkspaces } from '../package-manifests.ts'

// A bun.lock as bun 1.2.6 writes it: a comma after the last member of every object and array, which
// JSON.parse refuses.
export const bunLockText = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "a-monorepo",
      "devDependencies": {
        "turbo": "2.0.0",
      },
    },
    "packages/shipped": {
      "name": "shipped",
      "version": "0.0.0",
      "peerDependencies": {
        "shared-plugin": "^1.0.0",
      },
    },
  },
  "packages": {
    "turbo": ["turbo@2.0.0", "", {}, "sha512-0"],
  },
}
`

export const workspacesInTheBunLockText: LockedWorkspaces = {
  '': { name: 'a-monorepo', devDependencies: { turbo: '2.0.0' } },
  'packages/shipped': { name: 'shipped', version: '0.0.0', peerDependencies: { 'shared-plugin': '^1.0.0' } },
}
