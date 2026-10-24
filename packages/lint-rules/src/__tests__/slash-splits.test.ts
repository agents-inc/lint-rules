import { foundOr } from '@workspace/rule-data/collections'
import { describe, expect, it } from 'vitest'
import {
  CUTS_AT_NO_SLASH,
  LAST_SLASH_FOUND_IN_A_CALLBACK,
  PREFIX_CUT_AT_A_WRITTEN_SLASH,
  PREFIX_CUT_OF_A_GENERIC_ID,
  PREFIX_CUT_OF_A_RULE_ID_UNION,
  SLASH_SEARCH_OF_A_LIST_A_GENERIC_IS_CONSTRAINED_TO,
  SLASH_SEARCH_OF_A_STRING_OR_A_LIST,
  SPLIT_AT_A_SLASH_AT_THE_TOP_LEVEL,
  SPLIT_AT_A_SLASH_HELD_IN_A_CONSTANT,
  SPLIT_OF_AN_ID_THAT_MAY_BE_MISSING,
  SPLIT_OF_AN_ID_THAT_MAY_BE_NULL,
} from './cases/slash-splits.ts'
import { programOfFiles } from './factories/typescript-program-factories.ts'
import { type SlashSplit, slashSplitsIn } from './slash-splits.ts'

const MODULE = '/project/module.ts'

function slashSplitsOfModule(text: string): SlashSplit[] {
  const program = programOfFiles({ [MODULE]: text })
  return slashSplitsIn(foundOr(program.getSourceFile(MODULE), `the program holds no ${MODULE}`), program.getTypeChecker())
}

describe('slashSplitsIn', () => {
  it.each([
    { how: 'a prefix cut where indexOf finds a written slash', text: PREFIX_CUT_AT_A_WRITTEN_SLASH, splits: [{ in: 'prefixOf', method: 'indexOf' }] },
    { how: 'a split at a slash a constant holds', text: SPLIT_AT_A_SLASH_HELD_IN_A_CONSTANT, splits: [{ in: 'namePartsOf', method: 'split' }] },
    { how: 'a lastIndexOf in a callback, by the function around it', text: LAST_SLASH_FOUND_IN_A_CALLBACK, splits: [{ in: 'lastSegmentsOf', method: 'lastIndexOf' }] },
    { how: 'a split at the top level', text: SPLIT_AT_A_SLASH_AT_THE_TOP_LEVEL, splits: [{ in: '(top level)', method: 'split' }] },
  ])('finds $how', ({ text, splits }) => {
    expect(slashSplitsOfModule(text)).toStrictEqual(splits)
  })

  it('finds no cut at another separator, no search of an array, and no join', () => {
    expect(slashSplitsOfModule(CUTS_AT_NO_SLASH)).toStrictEqual([])
  })
})

describe('slashSplitsIn, on a string whose type is a union', () => {
  it('finds a prefix cut of a rule ID typed as a union of rule IDs', () => {
    expect(slashSplitsOfModule(PREFIX_CUT_OF_A_RULE_ID_UNION)).toStrictEqual([{ in: 'prefixOf', method: 'indexOf' }])
  })

  it('finds a split of a rule ID that may be missing, through optional chaining', () => {
    expect(slashSplitsOfModule(SPLIT_OF_AN_ID_THAT_MAY_BE_MISSING)).toStrictEqual([{ in: 'namePartsOf', method: 'split' }])
  })

  it('finds a split of a rule ID that may be null, through optional chaining', () => {
    expect(slashSplitsOfModule(SPLIT_OF_AN_ID_THAT_MAY_BE_NULL)).toStrictEqual([{ in: 'namePartsOf', method: 'split' }])
  })

  it('finds no search of a value that may be a list rather than a string', () => {
    expect(slashSplitsOfModule(SLASH_SEARCH_OF_A_STRING_OR_A_LIST)).toStrictEqual([])
  })
})

describe('slashSplitsIn, on a value whose type is a type parameter', () => {
  it('finds a prefix cut of a rule ID whose type parameter is constrained to string', () => {
    expect(slashSplitsOfModule(PREFIX_CUT_OF_A_GENERIC_ID)).toStrictEqual([{ in: 'prefixOf', method: 'indexOf' }])
  })

  it('finds no search of a value whose type parameter is constrained to a list', () => {
    expect(slashSplitsOfModule(SLASH_SEARCH_OF_A_LIST_A_GENERIC_IS_CONSTRAINED_TO)).toStrictEqual([])
  })
})
