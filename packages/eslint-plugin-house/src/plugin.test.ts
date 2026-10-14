import { describe, expect, it } from 'vitest'

import { housePlugin } from './index.ts'

const HOUSE_RULE_NAMES = [
  'dialog-has-accessible-name',
  'hook-file-naming',
  'max-hooks-per-component',
  'named-hook-callback',
  'no-classic-loops',
  'no-controlled-field-without-change-handler',
  'no-create-context-in-render',
  'no-create-object-url-in-render',
  'no-focusable-content-in-aria-hidden',
  'no-nested-interactive',
  'no-placeholder-only-field',
  'no-section-banner',
  'no-side-effect-in-state-updater',
  'no-suppressions',
  'no-unstable-list-keys',
  'prefer-line-comments',
  'require-class-helper',
]

describe('housePlugin', () => {
  it('registers the seventeen house rules and nothing else', () => {
    expect(Object.keys(housePlugin.rules).toSorted()).toStrictEqual(HOUSE_RULE_NAMES)
  })

  it("declares the 'house' namespace", () => {
    expect(housePlugin.meta.namespace).toStrictEqual('house')
  })
})
