import { describe, expect, it } from 'vitest'
import { globsReadFromTheRoot } from './globs-read-from-above.ts'

// Every `fromTheRoot` below was checked against ESLint's minimatch 10.2.6 (`dot: true`), matching a file
// under the root from above and from the root.

describe('globsReadFromTheRoot', () => {
  it.each([
    { how: 'a folder it names', glob: 'app/src/**', folders: ['app'], fromTheRoot: ['src/**'] },
    { how: 'no glob where it names another folder', glob: 'lib/**', folders: ['app'], fromTheRoot: [] },
    { how: 'no glob where it ends at the root itself, which is no file under it', glob: 'app', folders: ['app'], fromTheRoot: [] },
    { how: 'a dot as itself, matching the folder it names', glob: 'web.app/**', folders: ['web.app'], fromTheRoot: ['**'] },
    { how: 'a dot as itself, matching no other character', glob: 'web.app/**', folders: ['webxapp'], fromTheRoot: [] },
    { how: 'parentheses after no extglob character as themselves', glob: 'v(1)/**', folders: ['v(1)'], fromTheRoot: ['**'] },
    { how: 'a leading ./ as ESLint drops it', glob: './app/src/*.ts', folders: ['app'], fromTheRoot: ['src/*.ts'] },
    { how: 'a negated glob as negated, its leading ./ dropped', glob: '!./app/gen/**', folders: ['app'], fromTheRoot: ['!gen/**'] },
    { how: 'a negated glob as negated', glob: '!app/gen/**', folders: ['app'], fromTheRoot: ['!gen/**'] },
  ])('reads $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  it.each([
    { how: 'as matching the root\'s folders, and any below them', glob: '**/x.ts', folders: ['a', 'b'], fromTheRoot: ['**/x.ts'] },
    {
      how: 'between two folders once for each way it reads past the root\'s: ending at its last folder, or going on below it',
      glob: 'a/**/c/*.ts',
      folders: ['a', 'b', 'c'],
      fromTheRoot: ['**/c/*.ts', '*.ts'],
    },
  ])('reads a ** $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  it.each([
    { how: 'a * as any characters in a name', glob: 'ap*/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'a * as matching a leading dot too, as ESLint reads globs with dot: true', glob: '*/src/**', folders: ['.config'], fromTheRoot: ['src/**'] },
    { how: 'a ? as one character', glob: 'ap?/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'an escaped * as itself', glob: String.raw`a\*b/**`, folders: ['a*b'], fromTheRoot: ['**'] },
    { how: 'an escaped * as matching no other character', glob: String.raw`a\*b/**`, folders: ['axb'], fromTheRoot: [] },
  ])('reads $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  it.each([
    { how: 'one of its characters', glob: '[ab]pp/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'none but its characters', glob: '[ab]pp/**', folders: ['epp'], fromTheRoot: [] },
    { how: 'negated by !, any character but its own', glob: '[!b]pp/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'negated by ^, any character but its own', glob: '[^b]pp/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'negated, none of its own characters', glob: '[!a]pp/**', folders: ['app'], fromTheRoot: [] },
  ])('reads a character class as matching $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  it.each([
    { how: 'its first alternative', glob: '{app,lib}/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'an alternative after the first', glob: '{lib,app}/**', folders: ['app'], fromTheRoot: ['**'] },
    { how: 'an alternative between the text around the braces', glob: 'v{1,2}-api/**', folders: ['v2-api'], fromTheRoot: ['**'] },
    { how: 'an alternative of braces inside braces', glob: '{lib,ap{p,i}}/src/**', folders: ['app'], fromTheRoot: ['src/**'] },
    { how: 'no folder none of its alternatives names', glob: '{lib,docs}/**', folders: ['app'], fromTheRoot: [] },
  ])('reads braces as matching $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  // A segment holding an extglob matches no folder (a known limit), nor does ESLint here. `null` is a folder's name too.
  it.each([
    { how: 'a folder it does not name', glob: '@(lib)/**', folders: ['app'], fromTheRoot: [] },
    { how: 'a folder named as its characters read as themselves', glob: '@(app)/**', folders: ['app)'], fromTheRoot: [] },
    { how: 'a folder named null', glob: '@(app)/**', folders: ['null'], fromTheRoot: [] },
  ])('reads an extglob as matching no folder, where ESLint matches none either: $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })

  // ESLint's minimatch builds its RegExp without the `u` flag, so a character outside the BMP is two code units.
  it.each([
    { how: 'one ? matching no emoji', glob: '?/**', folders: ['😀'], fromTheRoot: [] },
    { how: 'two ? matching one emoji', glob: '??/**', folders: ['😀'], fromTheRoot: ['**'] },
    { how: 'a negated class matching no emoji', glob: '[!a]/**', folders: ['😀'], fromTheRoot: [] },
  ])('counts a character outside the Basic Multilingual Plane as two, as ESLint does: $how', ({ glob, folders, fromTheRoot }) => {
    expect(globsReadFromTheRoot(glob, folders)).toStrictEqual(fromTheRoot)
  })
})
