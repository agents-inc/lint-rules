import { describe, expect, it } from 'vitest'

import { optionListsTheSchemaTakes, optionsOnlyTheFirstSchemaTakes } from './schema-options.ts'

describe('optionListsTheSchemaTakes', () => {
  it('lists each enum value of a position, and each boolean, number and string a property takes, in an object of its own', () => {
    expect(
      optionListsTheSchemaTakes([
        { type: 'object', properties: { flag: { type: 'boolean' }, max: { type: 'integer' }, pattern: { type: 'string' }, mode: { enum: ['a', 'b'] } } },
      ]),
    ).toStrictEqual([
      { options: [{}], keys: [] },
      { options: [{ flag: true }], keys: ['flag'] },
      { options: [{ flag: false }], keys: ['flag'] },
      { options: [{ max: 1 }], keys: ['max'] },
      { options: [{ pattern: 'x' }], keys: ['pattern'] },
      { options: [{ mode: 'a' }], keys: ['mode'] },
      { options: [{ mode: 'b' }], keys: ['mode'] },
    ])
  })

  it('lists an empty array and an array of each item value, at any depth', () => {
    expect(optionListsTheSchemaTakes([{ type: 'object', properties: { allow: { type: 'array', items: { enum: ['p', 'q'] } } } }])).toStrictEqual([
      { options: [{}], keys: [] },
      { options: [{ allow: [] }], keys: ['allow'] },
      { options: [{ allow: ['p'] }], keys: ['allow'] },
      { options: [{ allow: ['q'] }], keys: ['allow'] },
    ])
  })

  it('varies each position after the first value of each position before it', () => {
    expect(optionListsTheSchemaTakes([{ enum: ['always', 'never'] }, { type: 'object', properties: { strict: { type: 'boolean' } } }])).toStrictEqual([
      { options: ['always'], keys: [] },
      { options: ['never'], keys: [] },
      { options: ['always', {}], keys: [] },
      { options: ['always', { strict: true }], keys: ['strict'] },
      { options: ['always', { strict: false }], keys: ['strict'] },
    ])
  })

  it('lists the values of each alternative once, a list two alternatives share once', () => {
    expect(
      optionListsTheSchemaTakes([{ oneOf: [{ type: 'object', properties: { a: { enum: [1] } } }, { type: 'object', properties: { b: { enum: [2] } } }] }]),
    ).toStrictEqual([
      { options: [{}], keys: [] },
      { options: [{ a: 1 }], keys: ['a'] },
      { options: [{ b: 2 }], keys: ['b'] },
    ])
  })

  it('reads a schema whose alternatives are whole lists, as an object schema of arrays writes them', () => {
    expect(
      optionListsTheSchemaTakes({
        anyOf: [
          { type: 'array', items: [{ enum: ['always'] }] },
          { type: 'array', items: [{ enum: ['never'] }, { type: 'object', properties: { loops: { type: 'boolean' } } }] },
        ],
      }),
    ).toStrictEqual([
      { options: ['always'], keys: [] },
      { options: ['never'], keys: [] },
      { options: ['never', {}], keys: [] },
      { options: ['never', { loops: true }], keys: ['loops'] },
      { options: ['never', { loops: false }], keys: ['loops'] },
    ])
  })

  it('follows a reference to a node of the schema', () => {
    expect(optionListsTheSchemaTakes({ type: 'array', items: [{ $ref: '#/$defs/level' }], $defs: { level: { enum: ['low', 'high'] } } })).toStrictEqual([
      { options: ['low'], keys: [] },
      { options: ['high'], keys: [] },
    ])
  })

  it('throws on a reference to nothing in the schema', () => {
    expect(() => optionListsTheSchemaTakes({ type: 'array', items: [{ $ref: '#/$defs/missing' }] })).toThrow('a schema reference to nothing: #/$defs/missing')
  })

  it('lists nothing for a rule that takes no options', () => {
    expect(optionListsTheSchemaTakes([])).toStrictEqual([])
  })
})

describe('optionsOnlyTheFirstSchemaTakes', () => {
  const second = [
    {
      type: 'object',
      properties: { shared: { type: 'boolean' }, allow: { type: 'array', items: { enum: ['functions', 'methods'] } } },
    },
  ]

  it('names each key the second schema has not, but not the keys below it', () => {
    const first = [
      {
        type: 'object',
        properties: { shared: { type: 'boolean' }, fixes: { type: 'object', properties: { imports: { type: 'boolean' } } } },
      },
    ]

    expect(optionsOnlyTheFirstSchemaTakes(first, second)).toStrictEqual(['.fixes'])
  })

  it("names each enum value at a key both have that the second's enum there lacks, and none under a key only the first has", () => {
    const first = [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { enum: ['functions', 'methods', 'private-constructors'] } },
          scope: { oneOf: [{ type: 'boolean' }, { enum: ['public-fields'] }] },
        },
      },
    ]

    expect(optionsOnlyTheFirstSchemaTakes(first, second)).toStrictEqual(['.allow[]="private-constructors"', '.scope'])
  })

  it('names an enum value of a position the second schema lacks', () => {
    expect(optionsOnlyTheFirstSchemaTakes([{ enum: ['all', 'local', 'none'] }], [{ enum: ['all', 'local'] }])).toStrictEqual(['="none"'])
  })

  it('names nothing where the schemas take the same options', () => {
    expect(optionsOnlyTheFirstSchemaTakes(second, second)).toStrictEqual([])
  })
})
