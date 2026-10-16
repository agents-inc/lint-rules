import { describe, expect, it } from 'vitest'

import type { CanonicalRule } from '../generate/build-routing.ts'
import { buildCanonicalRule } from './factories/inventory-factories.ts'
import { coveredByOffenders, splitByTypesOffenders } from './relation-offenders.ts'

const BECAUSE = 'card: why'

/** A shipped rule ESLint runs untyped on every file, in the ruleset given, related to no other rule unless given. */
function eslintRule(id: string, ruleset: string, fields: Partial<Pick<CanonicalRule, 'alwaysOn' | 'coveredBy' | 'files' | 'ignores' | 'splitByTypesWith' | 'typed' | 'whenSuppressions'>> = {}): CanonicalRule {
  return buildCanonicalRule(id, { engine: 'eslint', ruleset, options: [], typed: false, ...fields })
}

function oxlintRule(id: string, ruleset: string, fields: Partial<Pick<CanonicalRule, 'coveredBy' | 'splitByTypesWith'>> = {}): CanonicalRule {
  return buildCanonicalRule(id, { engine: 'oxlint', oxlintName: id, ruleset, options: [], typed: false, ...fields })
}

function coveredBy(rule: string): Pick<CanonicalRule, 'coveredBy'> {
  return { coveredBy: { rule, because: BECAUSE } }
}

function splitByTypesWith(rule: string): Pick<CanonicalRule, 'splitByTypesWith'> {
  return { splitByTypesWith: { rule, because: BECAUSE } }
}

describe('coveredByOffenders', () => {
  it('names nothing for a rule covered by a shipped rule in another ruleset, oxlint running either', () => {
    const rules = [oxlintRule('a/narrow', 'correctness', coveredBy('b/broad')), eslintRule('b/broad', 'declarative')]

    expect(coveredByOffenders(rules)).toStrictEqual([])
  })

  it('names a pair in one ruleset, beside a pair in two, which it does not', () => {
    const rules = [
      eslintRule('a/narrow', 'declarative', coveredBy('b/broad')),
      eslintRule('b/broad', 'declarative'),
      eslintRule('c/narrow', 'correctness', coveredBy('d/broad')),
      eslintRule('d/broad', 'declarative'),
    ]

    expect(coveredByOffenders(rules)).toStrictEqual(['a/narrow covered by b/broad: both are in declarative'])
  })

  it('names a cover that does not ship, beside one that does', () => {
    const rules = [eslintRule('a/narrow', 'correctness', coveredBy('b/unshipped')), eslintRule('c/narrow', 'correctness', coveredBy('d/broad')), eslintRule('d/broad', 'declarative')]

    expect(coveredByOffenders(rules)).toStrictEqual(['a/narrow covered by b/unshipped: the cover does not ship'])
  })

  it('names a covered rule and a cover turned on always or by allowSuppressions rather than by a ruleset, beside a pair each in a ruleset', () => {
    const rules = [
      eslintRule('a/always', 'correctness', { alwaysOn: true, ...coveredBy('b/broad') }),
      eslintRule('b/broad', 'declarative'),
      eslintRule('c/narrow', 'correctness', coveredBy('d/suppressions')),
      eslintRule('d/suppressions', 'comments', { whenSuppressions: { banned: 'off', allowed: 'on' } }),
      eslintRule('e/narrow', 'correctness', coveredBy('b/broad')),
    ]

    expect(coveredByOffenders(rules)).toStrictEqual([
      'a/always covered by b/broad: the covered rule is turned on by no ruleset',
      'c/narrow covered by d/suppressions: the cover is turned on by no ruleset',
    ])
  })

  it('names a rule covering itself', () => {
    const rules = [eslintRule('a/narrow', 'correctness', coveredBy('a/narrow'))]

    expect(coveredByOffenders(rules)).toStrictEqual([
      'a/narrow covered by a/narrow: the cover is covered by another rule',
      'a/narrow covered by a/narrow: the rule covers itself',
      'a/narrow covered by a/narrow: both are in correctness',
    ])
  })

  it('names a cover that is covered in turn, and a cover that splits by types, beside a cover that is neither', () => {
    const rules = [
      eslintRule('a/narrow', 'correctness', coveredBy('b/middle')),
      eslintRule('b/middle', 'declarative', coveredBy('c/broad')),
      eslintRule('c/broad', 'immutability'),
      eslintRule('d/narrow', 'correctness', coveredBy('e/untyped')),
      eslintRule('e/untyped', 'redundancy', splitByTypesWith('f/typed')),
      eslintRule('f/typed', 'type-safety', { typed: true }),
    ]

    expect(coveredByOffenders(rules)).toStrictEqual([
      'a/narrow covered by b/middle: the cover is covered by another rule',
      'd/narrow covered by e/untyped: the cover splits by types with another rule',
    ])
  })
})

describe('splitByTypesOffenders', () => {
  it('names nothing for an untyped ESLint rule split by types with a typed one, each on every file in a ruleset', () => {
    const rules = [eslintRule('a/untyped', 'correctness', splitByTypesWith('b/typed')), eslintRule('b/typed', 'correctness', { typed: true })]

    expect(splitByTypesOffenders(rules)).toStrictEqual([])
  })

  it('names a typed partner that does not ship, beside one that does', () => {
    const rules = [
      eslintRule('a/untyped', 'correctness', splitByTypesWith('b/unshipped')),
      eslintRule('c/untyped', 'correctness', splitByTypesWith('d/typed')),
      eslintRule('d/typed', 'correctness', { typed: true }),
    ]

    expect(splitByTypesOffenders(rules)).toStrictEqual(['a/untyped split by types with b/unshipped: the typed rule does not ship'])
  })

  it('names an untyped rule that is typed, run by oxlint, scoped, turned on by no ruleset or covered, beside one that is none of them', () => {
    const typedRule = eslintRule('z/typed', 'correctness', { typed: true })
    const rules = [
      eslintRule('a/typed-itself', 'correctness', { typed: true, ...splitByTypesWith('z/typed') }),
      oxlintRule('b/in-oxlint', 'correctness', splitByTypesWith('y/typed')),
      eslintRule('c/scoped', 'correctness', { files: ['**/*.ts'], ...splitByTypesWith('x/typed') }),
      eslintRule('d/always', 'correctness', { alwaysOn: true, ...splitByTypesWith('w/typed') }),
      eslintRule('e/covered', 'correctness', { ...coveredBy('v/broad'), ...splitByTypesWith('u/typed') }),
      eslintRule('f/holds', 'correctness', splitByTypesWith('t/typed')),
      typedRule,
      ...['y/typed', 'x/typed', 'w/typed', 'u/typed', 't/typed'].map((id) => eslintRule(id, 'correctness', { typed: true })),
      eslintRule('v/broad', 'declarative'),
    ]

    expect(splitByTypesOffenders(rules)).toStrictEqual([
      'a/typed-itself split by types with z/typed: the untyped rule is typed',
      'b/in-oxlint split by types with y/typed: the untyped rule is run by oxlint',
      'c/scoped split by types with x/typed: the untyped rule is scoped by files or ignores',
      'd/always split by types with w/typed: the untyped rule is turned on by no ruleset',
      'e/covered split by types with u/typed: the untyped rule is covered by another rule',
    ])
  })

  it('names a typed rule that is untyped, run by oxlint, scoped, turned on by no ruleset, covered or split by types, beside one that is none of them', () => {
    const rules = [
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => eslintRule(`${name}/untyped`, 'correctness', splitByTypesWith(`${name}/partner`))),
      eslintRule('a/partner', 'correctness'),
      oxlintRule('b/partner', 'correctness'),
      eslintRule('c/partner', 'correctness', { typed: true, ignores: ['**/*.test.ts'] }),
      eslintRule('d/partner', 'correctness', { typed: true, whenSuppressions: { banned: 'on', allowed: 'off' } }),
      eslintRule('e/partner', 'correctness', { typed: true, ...coveredBy('z/broad') }),
      eslintRule('f/partner', 'correctness', { typed: true, ...splitByTypesWith('y/other') }),
      eslintRule('g/partner', 'correctness', { typed: true }),
      eslintRule('z/broad', 'declarative'),
      eslintRule('y/other', 'correctness', { typed: true }),
    ]

    expect(splitByTypesOffenders(rules)).toStrictEqual([
      'a/untyped split by types with a/partner: the typed rule is untyped',
      'b/untyped split by types with b/partner: the typed rule is untyped',
      'b/untyped split by types with b/partner: the typed rule is run by oxlint',
      'c/untyped split by types with c/partner: the typed rule is scoped by files or ignores',
      'd/untyped split by types with d/partner: the typed rule is turned on by no ruleset',
      'e/untyped split by types with e/partner: the typed rule is covered by another rule',
      'f/untyped split by types with f/partner: the typed rule splits by types with another rule',
      'f/partner split by types with y/other: the untyped rule is typed',
    ])
  })

  it('names a typed rule two untyped rules name, and none one untyped rule names', () => {
    const rules = [
      eslintRule('a/untyped', 'correctness', splitByTypesWith('c/typed')),
      eslintRule('b/untyped', 'correctness', splitByTypesWith('c/typed')),
      eslintRule('c/typed', 'correctness', { typed: true }),
      eslintRule('d/untyped', 'correctness', splitByTypesWith('e/typed')),
      eslintRule('e/typed', 'correctness', { typed: true }),
    ]

    expect(splitByTypesOffenders(rules)).toStrictEqual(['c/typed: the typed partner of a/untyped, b/untyped'])
  })
})
