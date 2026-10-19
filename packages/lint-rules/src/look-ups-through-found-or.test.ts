import { fileURLToPath } from 'node:url'
import { lookUpsWrittenOutIn } from '@workspace/rule-data/test-support/look-ups-written-out'
import { describe, expect, it } from 'vitest'

const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url))

describe('the source of lint-rules, tests aside', () => {
  it("writes out no look-up that throws on a miss: each goes through rule-data's foundOr, keeping its message", () => {
    expect(lookUpsWrittenOutIn(SOURCE_DIR)).toStrictEqual([])
  })
})
