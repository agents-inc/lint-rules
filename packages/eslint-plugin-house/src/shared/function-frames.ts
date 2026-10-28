import type { TSESLint } from '@typescript-eslint/utils'

import { type FunctionNode, functionNameOf } from './function-name.ts'

/** A function the walk is inside. `rendersJsx` records only the JSX it renders itself, not a nested callback's. */
export type FunctionFrame = { node: FunctionNode; rendersJsx: boolean }

type FrameHandlers<Frame extends FunctionFrame> = {
  ruleName: string
  frameFor: (node: Readonly<FunctionNode>) => Frame
  // Called with the frame just left, and the frame of the function enclosing it, or undefined at module scope.
  onLeave?: (frame: Readonly<Frame>, enclosing: Readonly<Frame> | undefined) => void
}

/** The frames of the functions the walk is inside, innermost last, and the visitors that keep them in step with it. */
type FunctionFrames<Frame extends FunctionFrame> = { frames: readonly Frame[]; visitors: TSESLint.RuleListener }

type WalkSteps = {
  enter: (node: Readonly<FunctionNode>) => void
  leave: () => void
  markJsx: () => void
}

const COMPONENT_NAME = /^[A-Z]/u

function visitorsTaking({ enter, leave, markJsx }: Readonly<WalkSteps>): TSESLint.RuleListener {
  return {
    FunctionDeclaration: enter,
    'FunctionDeclaration:exit': leave,
    FunctionExpression: enter,
    'FunctionExpression:exit': leave,
    ArrowFunctionExpression: enter,
    'ArrowFunctionExpression:exit': leave,
    JSXElement: markJsx,
    JSXFragment: markJsx,
  }
}

/** Frames kept in step with the walk, each handed to `onLeave` as the walk leaves its function. */
export function functionFramesOfTheWalk<Frame extends FunctionFrame>({ ruleName, frameFor, onLeave }: Readonly<FrameHandlers<Frame>>): FunctionFrames<Frame> {
  const frames: Frame[] = []
  function enter(node: Readonly<FunctionNode>): void {
    frames.push(frameFor(node))
  }
  function leave(): void {
    const frame = frames.pop()
    if (frame === undefined) throw new Error(`${ruleName} left a function it never entered`)
    onLeave?.(frame, frames.at(-1))
  }
  function markJsx(): void {
    const frame = frames.at(-1)
    if (frame !== undefined) frame.rendersJsx = true
  }
  return { frames, visitors: visitorsTaking({ enter, leave, markJsx }) }
}

/** The name of a component: a function named in PascalCase that renders JSX itself. Null for anything else. */
export function componentNameOf(frame: Readonly<FunctionFrame>): string | null {
  const name = functionNameOf(frame.node)
  return name !== null && COMPONENT_NAME.test(name) && frame.rendersJsx ? name : null
}
