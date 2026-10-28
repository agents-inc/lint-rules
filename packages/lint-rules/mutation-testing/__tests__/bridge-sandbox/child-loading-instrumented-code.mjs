// Spawned by children-spawned.fixture.mjs, as a test of this repo spawns ESLint or oxlint on the instrumented dist/: it
// loads instrumented code and covers the mutants it is given, then records, under the label it is given, the mutant
// on in it and whether it runs with the option only the NODE_OPTIONS of the run that spawned it set.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { activeMutant, cover } from './instrumented-module-stand-in.mjs'

const [recordsDir, label, ...mutantIds] = process.argv.slice(2)
if (recordsDir === undefined || label === undefined) throw new Error('give the folder to record in, a label, then the mutants to cover')

cover(...mutantIds)
mkdirSync(recordsDir, { recursive: true })
writeFileSync(join(recordsDir, `${label}.json`), JSON.stringify({ activeMutant: activeMutant(), hasTheRunsNodeOptions: process.noDeprecation === true }))
