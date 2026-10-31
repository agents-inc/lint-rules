import { DEBUGGER_STATEMENT, moduleText } from '../factories/check-factories.ts'

/** no-debugger, line 2. */
export const PAUSE_FILE = 'src/pause.ts'
export const PAUSE = moduleText('export function pause() {', `  ${DEBUGGER_STATEMENT}`, '}')

/** unicorn/no-break-in-nested-loop, line 6: the `break` leaves the switch, not the loop, so a token after END is kept. */
export const TOKENS_FILE = 'src/tokens.ts'
export const TOKENS = moduleText(
  'export function tokensBeforeEnd(tokens: readonly string[]) {',
  '  const kept: string[] = []',
  '  for (const token of tokens) {',
  '    switch (token) {',
  "      case 'END':",
  '        break',
  '      default:',
  '        kept.push(token)',
  '    }',
  '  }',
  '  return kept',
  '}',
)

/** unicorn/no-late-event-control, line 4: after the `await`, preventDefault does nothing, in Node as in a browser. */
export const LATE_EVENT_FILE = 'src/late-event.ts'
export const LATE_EVENT = moduleText(
  'export function listen(target: EventTarget, save: () => Promise<void>) {',
  "  target.addEventListener('submit', async (event) => {",
  '    await save()',
  '    event.preventDefault()',
  '  })',
  '}',
)

/** unicorn/no-new-array, line 2. */
export const SLOTS_FILE = 'src/slots.ts'
export const SLOTS = moduleText('export function slots(size: number) {', '  return new Array(size)', '}')

/** A worker's postMessage, which takes no target origin. */
export const POST_MESSAGE_FILE = 'src/post-message.ts'
export const POST_MESSAGE = moduleText('export function send(worker: Worker, data: unknown) {', '  worker.postMessage(data)', '}')

/** `module Shapes`, which @typescript-eslint/prefer-namespace-keyword rewrites to `namespace Shapes`. */
export const SHAPES_FILE = 'src/shapes.ts'
export const SHAPES = moduleText('module Shapes {', '  export const sides = 4', '}')

export const SHAPES_DECLARATION_FILE = 'types/shapes.d.ts'
export const SHAPES_DECLARED = moduleText('declare module Shapes {', '  export const sides: number', '}')
export const SHAPES_DECLARED_AS_A_NAMESPACE = moduleText('declare namespace Shapes {', '  export const sides: number', '}')
