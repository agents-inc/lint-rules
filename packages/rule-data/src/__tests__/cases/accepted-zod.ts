import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The zod rules the owner accepted on 2026-10-24: each reports the card's schema and stays silent on its corrected
// form, and on a shape its code says it leaves alone. The plugin finds zod by a file's import source alone, so no
// case installs it.

const IMPORTS_ZOD = "import { z } from 'zod'\n\n"

/** Each shipped accepted zod rule's report case beside its silent twin, in the order of their IDs. */
export const ACCEPTED_ZOD_CASES: readonly RuleCase[] = [
  // Another coercion is not the boolean one.
  {
    rule: 'zod/no-coerce-boolean',
    silentIn: [
      { path: 'src/stringbool.ts', source: `${IMPORTS_ZOD}export const Query = z.object({ archived: z.stringbool() })\n` },
      { path: 'src/coerce-number.ts', source: `${IMPORTS_ZOD}export const Query = z.object({ page: z.coerce.number() })\n` },
    ],
    reportedIn: [{ path: 'src/coerce-boolean.ts', source: `${IMPORTS_ZOD}export const Query = z.object({ archived: z.coerce.boolean() })\n` }],
  },
  // After .array() the bounds apply to the list, not to the string.
  {
    rule: 'zod/no-conflicting-checks',
    silentIn: [
      { path: 'src/min-below-max.ts', source: `${IMPORTS_ZOD}export const Age = z.number().min(10).max(18)\n` },
      { path: 'src/bounds-on-two-schemas.ts', source: `${IMPORTS_ZOD}export const Tags = z.string().min(18).array().max(10)\n` },
    ],
    reportedIn: [{ path: 'src/min-above-max.ts', source: `${IMPORTS_ZOD}export const Age = z.number().min(18).max(10)\n` }],
  },
  // Two refinements are two checks; after .array() a second .min() bounds the list.
  {
    rule: 'zod/no-duplicate-schema-methods',
    silentIn: [
      { path: 'src/trimmed-once.ts', source: `${IMPORTS_ZOD}export const Name = z.string().trim().min(1)\n` },
      {
        path: 'src/refined-twice.ts',
        source: `${IMPORTS_ZOD}export const Slug = z
  .string()
  .refine((value) => value === value.toLowerCase(), { message: 'Lower case only' })
  .refine((value) => !value.includes(' '), { message: 'No spaces' })
`,
      },
      { path: 'src/checks-on-two-schemas.ts', source: `${IMPORTS_ZOD}export const Names = z.string().min(1).array().min(1)\n` },
    ],
    reportedIn: [
      { path: 'src/trimmed-twice.ts', source: `${IMPORTS_ZOD}export const Name = z.string().trim().trim()\n` },
      { path: 'src/checked-before-and-after-trim.ts', source: `${IMPORTS_ZOD}export const Name = z.string().min(1).trim().min(1)\n` },
    ],
  },
  // A type argument names what the value should be, and checks none of it.
  {
    rule: 'zod/no-empty-custom-schema',
    silentIn: [
      {
        path: 'src/custom-with-check.ts',
        source: `${IMPORTS_ZOD}export const Px = z.custom<\`\${number}px\`>((value) => typeof value === 'string' && /^\\d+px$/u.test(value))\n`,
      },
    ],
    reportedIn: [
      { path: 'src/custom-without-check.ts', source: `${IMPORTS_ZOD}export const Anything = z.custom()\n` },
      { path: 'src/typed-custom-without-check.ts', source: `${IMPORTS_ZOD}export const Px = z.custom<\`\${number}px\`>()\n` },
    ],
  },
  // The items are optional and the list has the default: two schemas.
  {
    rule: 'zod/no-optional-and-default-together',
    silentIn: [
      { path: 'src/default-alone.ts', source: `${IMPORTS_ZOD}export const Settings = z.object({ theme: z.string().default('light') })\n` },
      { path: 'src/optional-items-default-list.ts', source: `${IMPORTS_ZOD}export const Tags = z.array(z.string().optional()).default([])\n` },
    ],
    reportedIn: [
      { path: 'src/optional-and-default.ts', source: `${IMPORTS_ZOD}export const Settings = z.object({ theme: z.string().optional().default('light') })\n` },
    ],
  },
  {
    rule: 'zod/no-throw-in-refine',
    silentIn: [
      { path: 'src/returns-in-refine.ts', source: `${IMPORTS_ZOD}export const Password = z.string().refine((value) => value.length >= 8, { message: 'Too short' })\n` },
    ],
    reportedIn: [
      {
        path: 'src/throws-in-refine.ts',
        source: `${IMPORTS_ZOD}export const Password = z.string().refine((value) => {
  if (value.length < 8) throw new Error('Too short')
  return true
})
`,
      },
    ],
  },
  // A value rewritten collides with nothing; a key rewritten can.
  {
    rule: 'zod/no-transform-in-record-key',
    silentIn: [
      { path: 'src/plain-key.ts', source: `${IMPORTS_ZOD}export const Headers = z.record(z.string(), z.string())\n` },
      { path: 'src/transformed-value.ts', source: `${IMPORTS_ZOD}export const Headers = z.record(z.string(), z.string().transform((value) => value.trim()))\n` },
    ],
    reportedIn: [
      { path: 'src/transformed-key.ts', source: `${IMPORTS_ZOD}export const Headers = z.record(z.string().transform((key) => key.toLowerCase()), z.string())\n` },
    ],
  },
  {
    rule: 'zod/require-brand-type-parameter',
    silentIn: [{ path: 'src/named-brand.ts', source: `${IMPORTS_ZOD}export const UserId = z.string().brand<'UserId'>()\n` }],
    reportedIn: [{ path: 'src/unnamed-brand.ts', source: `${IMPORTS_ZOD}export const UserId = z.string().brand()\n` }],
  },
]

/**
 * The cases of accepted zod rules whose build waits on a card, unrun until the owner answers it: once the rule ships,
 * its case moves to ACCEPTED_ZOD_CASES.
 *
 * prefer-trim-before-string-length-checks: check applies its fix, which moves .trim() before the length checks and so
 * changes what the schema accepts (measured with zod 3 and 4): a value of only spaces then fails .min(1), and a padded
 * value longer than .max() then passes.
 */
export const ACCEPTED_ZOD_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  {
    heldBy: 'q-lint-rc-zod-trim-fix-measured',
    // A string with no .trim() has no order to fix.
    ruleCase: {
      rule: 'zod/prefer-trim-before-string-length-checks',
      silentIn: [
        { path: 'src/trimmed-before-check.ts', source: `${IMPORTS_ZOD}export const Name = z.string().trim().min(1)\n` },
        { path: 'src/checked-untrimmed.ts', source: `${IMPORTS_ZOD}export const Name = z.string().min(1)\n` },
      ],
      reportedIn: [{ path: 'src/checked-before-trim.ts', source: `${IMPORTS_ZOD}export const Name = z.string().min(1).trim()\n` }],
    },
  },
]
