import type { ProjectFiles } from '../temp-projects.ts'

// Each fix measured on oxlint 1.87.0, eslint-plugin-sonarjs 4.2.2 and typescript-eslint 8.71.2.

/** A file, the line check reports it on, and the rule that reports it there. */
type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

/** A file as written and as a fix leaves it. */
type FixedFile = { readonly file: string; readonly source: string; readonly fixed: string }

/**
 * Each file a withheld fix would break, in path order as check prints their findings. oxlint's no-new-wrappers fix
 * deletes `new`, so the label reads 'off' where it read 'on'; sonarjs' fix deletes the second row, so the test runs once.
 */
export const CODE_A_WITHHELD_FIX_WOULD_BREAK: readonly ReportedFile[] = [
  {
    file: 'src/feature-label.ts',
    source: `export function featureLabel(raw: string) {
  const enabled = new Boolean(raw === 'yes')
  return enabled ? 'on' : 'off'
}
`,
    line: 2,
    rule: 'no-new-wrappers',
  },
  {
    file: 'src/next-id.test.ts',
    source: `import { expect, it } from 'vitest'

let lastId = 0

function nextId() {
  lastId += 1
  return lastId
}

it.each([
  [nextId()],
  [nextId()],
])('gives row %i an id of its own', (id) => {
  expect(id).toBeGreaterThan(0)
})
`,
    line: 12,
    rule: 'sonarjs/no-duplicate-parameterized-test-case',
  },
]

/** The tsconfig compiler options of a project injecting services by their emitted constructor parameter types (NestJS, TypeORM). */
export const DECORATOR_METADATA = { experimentalDecorators: true, emitDecoratorMetadata: true } as const

/** The same project's decorators, emitting no metadata. */
export const DECORATORS_ALONE = { experimentalDecorators: true } as const

/** The modules the services import, committed, so check reads them and checks the services alone. */
export const SERVICE_IMPORTS: ProjectFiles = {
  'src/api.ts': `export class Api {
  get(path: string) {
    return path
  }
}
`,
  'src/injectable.ts': 'export const Injectable = (): ClassDecorator => () => {}\n',
}

/** Under emitDecoratorMetadata the emitted design:paramtypes reads Api, so this import is a value import; without it, a type import. */
export const DECORATED_SERVICE: FixedFile = {
  file: 'src/user-service.ts',
  source: `import { Api } from './api'
import { Injectable } from './injectable'

@Injectable()
export class UserService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`,
  fixed: `import type { Api } from './api'
import { Injectable } from './injectable'

@Injectable()
export class UserService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`,
}

/** No decorator, so nothing reads Api at run time and the import is a type import. */
export const UNDECORATED_SERVICE: FixedFile = {
  file: 'src/plain-service.ts',
  source: `import { Api } from './api'

export class PlainService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`,
  fixed: `import type { Api } from './api'

export class PlainService {
  readonly api: Api

  constructor(api: Api) {
    this.api = api
  }
}
`,
}
