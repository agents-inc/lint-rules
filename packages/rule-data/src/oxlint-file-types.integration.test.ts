import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import oxlintFileTypes from '../data/oxlint-file-types.json' with { type: 'json' }
import {
  DEBUGGER_STATEMENT,
  type FileType,
  LINTED_EXTENSIONS,
  NOT_LINTED_FILES,
  RULE_TRIGGERS,
  type RuleTrigger,
} from './__tests__/cases/oxlint-rule-triggers.ts'
import { buildOxlintConfigEnabling, buildOxlintConfigRunningEachRuleIn } from './__tests__/factories/oxlint-config-factories.ts'
import {
  FILE_TYPES,
  fileTextHolding,
  fileTypesWrittenTheRuleRunsIn,
  outcomesOf,
  runOxlintJson,
  type TriggerOutcome,
} from './__tests__/oxlint-trigger-runs.ts'
import { setUpTempDir } from './__tests__/temp-dirs.ts'
import { fileTypesOxlintRunsTheRuleIn } from './oxlint-file-types.ts'
import { oxlintPluginOf } from './rule-id-parts.ts'

// data/oxlint-file-types.json, checked against the installed oxlint: each rule it guards, its code
// written into a file of every type, reports in exactly the file types the data says oxlint runs it
// in and in none it says the rule's guard skips, but where the file cannot hold the code. One
// oxlint run per file type, each rule turned on only in its own files.

const OXLINT_TIMEOUT_MS = 60_000
const RULES_CONFIG = 'rules.oxlintrc.json'
const EXTENSIONS_CONFIG = 'extensions.oxlintrc.json'
const EXTENSIONS_FOLDER = 'extensions'
// A rule no guard names: it runs in every file oxlint lints.
const UNGUARDED_RULE = 'no-debugger'

const GUARDED_RULES: readonly string[] = oxlintFileTypes.guards.flatMap(({ rules }) => rules)

/** What oxlint made of each rule's file of each type. */
type OutcomesByRule = ReadonlyMap<string, ReadonlyMap<FileType, TriggerOutcome>>

function triggerOf(rule: string): RuleTrigger {
  const trigger = RULE_TRIGGERS[rule]
  if (trigger === undefined) throw new Error(`no code draws ${rule}`)
  return trigger
}

function folderOf(type: FileType): string {
  return `files.${type}`
}

function fileOf(type: FileType, ruleIndex: number): string {
  return `${folderOf(type)}/rule-${String(ruleIndex)}.${type}`
}

function silentTypesOf({ silentIn }: RuleTrigger): readonly FileType[] {
  return silentIn === undefined ? [] : silentIn.types
}

/** The file types the data says oxlint runs the rule in. */
function typesTheDataRunsTheRuleIn(rule: string): FileType[] {
  return fileTypesWrittenTheRuleRunsIn(fileTypesOxlintRunsTheRuleIn(rule))
}

/** Where the rule's code owes a finding: each file type the data says oxlint runs it in that can hold the code, less those the code finds nothing in. */
function typesOwingAFinding(rule: string): FileType[] {
  const trigger = triggerOf(rule)
  return typesTheDataRunsTheRuleIn(rule).filter((type) => !trigger.unparsedIn.includes(type) && !silentTypesOf(trigger).includes(type))
}

describe("the file types data/oxlint-file-types.json says oxlint runs each rule it guards in, against the installed oxlint's reports", () => {
  const projectDir = setUpTempDir('rule-data-oxlint-file-types-')
  let outcomesByRule: OutcomesByRule = new Map()

  function typesWhere(rule: string, outcome: TriggerOutcome): FileType[] {
    const outcomes = outcomesByRule.get(rule)
    if (outcomes === undefined) throw new Error(`oxlint was not run over ${rule}'s files`)
    return FILE_TYPES.filter((type) => outcomes.get(type) === outcome)
  }

  async function writeEachRulesFileOfEachType(): Promise<void> {
    await Promise.all(FILE_TYPES.map((type) => mkdir(join(projectDir(), folderOf(type)))))
    await Promise.all(
      FILE_TYPES.flatMap((type) =>
        GUARDED_RULES.map((rule, index) => writeFile(join(projectDir(), fileOf(type, index)), fileTextHolding(type, triggerOf(rule)))),
      ),
    )
    const config = buildOxlintConfigRunningEachRuleIn(
      GUARDED_RULES.map((rule, index) => ({ files: [`**/rule-${String(index)}.*`], rule, options: triggerOf(rule).options })),
      { plugins: [...new Set(GUARDED_RULES.map(oxlintPluginOf))] },
    )
    await writeFile(join(projectDir(), RULES_CONFIG), JSON.stringify(config))
  }

  /** One oxlint run over the files of each type: what it made of each file. */
  function outcomesOfEachType(): { readonly type: FileType; readonly byFile: ReadonlyMap<string, TriggerOutcome> }[] {
    return FILE_TYPES.map((type) => ({
      type,
      byFile: outcomesOf(
        runOxlintJson(projectDir(), RULES_CONFIG, [folderOf(type)]),
        GUARDED_RULES.map((_rule, index) => fileOf(type, index)),
      ),
    }))
  }

  beforeAll(async () => {
    await writeEachRulesFileOfEachType()
    const ofEachType = outcomesOfEachType()
    outcomesByRule = new Map(
      GUARDED_RULES.map((rule, index) => [rule, new Map(ofEachType.map(({ type, byFile }) => [type, outcomeOfFile(byFile, fileOf(type, index))]))]),
    )
  }, OXLINT_TIMEOUT_MS)

  it('reports each rule in exactly the file types the data says oxlint runs it in, but those its code cannot be parsed in or finds nothing in', () => {
    expect(Object.fromEntries(GUARDED_RULES.map((rule) => [rule, typesWhere(rule, 'reports')]))).toStrictEqual(
      Object.fromEntries(GUARDED_RULES.map((rule) => [rule, typesOwingAFinding(rule)])),
    )
  })

  it("cannot parse each rule's code in exactly the file types its trigger names", () => {
    expect(Object.fromEntries(GUARDED_RULES.map((rule) => [rule, typesWhere(rule, 'cannot parse')]))).toStrictEqual(
      Object.fromEntries(GUARDED_RULES.map((rule) => [rule, FILE_TYPES.filter((type) => triggerOf(rule).unparsedIn.includes(type))])),
    )
  })
})

describe('data/oxlint-file-types.json', () => {
  it('holds a trigger for each rule it guards, and none for any other', () => {
    expect(Object.keys(RULE_TRIGGERS).toSorted()).toStrictEqual(GUARDED_RULES.toSorted())
  })

  it('names each rule in one guard only', () => {
    expect(GUARDED_RULES.filter((rule, index) => GUARDED_RULES.indexOf(rule) !== index)).toStrictEqual([])
  })

  it('has each guard skip only extensions oxlint lints by default', () => {
    const linted = fileTypesOxlintRunsTheRuleIn(UNGUARDED_RULE).extensions

    expect(oxlintFileTypes.guards.flatMap(({ skips }) => skips.filter((extension) => !linted.includes(extension)))).toStrictEqual([])
  })

  // A trigger silent where the data says oxlint runs its rule must be silent for a reason the
  // data does not record: one it records would belong in the rule's guard.
  it("keeps each rule's silent file types among those the data says oxlint runs it in", () => {
    expect(
      GUARDED_RULES.flatMap((rule) => silentTypesOf(triggerOf(rule)).filter((type) => !typesTheDataRunsTheRuleIn(rule).includes(type)).map((type) => `${rule}: ${type}`)),
    ).toStrictEqual([])
  })
})

describe('the extensions data/oxlint-file-types.json says oxlint lints by default, against the installed oxlint', () => {
  const projectDir = setUpTempDir('rule-data-oxlint-extensions-')

  beforeAll(async () => {
    await mkdir(join(projectDir(), EXTENSIONS_FOLDER))
    const lintedFiles = LINTED_EXTENSIONS.map((extension): [string, string] => [
      `a.${extension}`,
      fileTextHolding(extension, { code: DEBUGGER_STATEMENT, unparsedIn: [] }),
    ])
    await Promise.all(
      [...lintedFiles, ...Object.entries(NOT_LINTED_FILES)].map(([file, text]) => writeFile(join(projectDir(), EXTENSIONS_FOLDER, file), text)),
    )
    await writeFile(join(projectDir(), EXTENSIONS_CONFIG), JSON.stringify(buildOxlintConfigEnabling([UNGUARDED_RULE], { plugins: [] })))
  }, OXLINT_TIMEOUT_MS)

  it('lints a file of each of them, and no file of any other extension', () => {
    const report = runOxlintJson(projectDir(), EXTENSIONS_CONFIG, [EXTENSIONS_FOLDER])
    const extensions = fileTypesOxlintRunsTheRuleIn(UNGUARDED_RULE).extensions

    expect({
      filesLinted: report.number_of_files,
      filesReported: report.diagnostics.map(({ filename }) => filename).toSorted(),
    }).toStrictEqual({
      filesLinted: extensions.length,
      filesReported: extensions.map((extension) => `${EXTENSIONS_FOLDER}/a.${extension}`).toSorted(),
    })
  })
})

function outcomeOfFile(byFile: ReadonlyMap<string, TriggerOutcome>, file: string): TriggerOutcome {
  const outcome = byFile.get(file)
  if (outcome === undefined) throw new Error(`oxlint was not run over ${file}`)
  return outcome
}
