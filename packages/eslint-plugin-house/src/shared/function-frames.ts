import type { TSESLint } from '@typescript-eslint/utils'

import { type FunctionNode, functionNameOf } from './function-name.ts'

/** A function the walk is inside. `rendersJsx` records only the JSX it renders itself, not a nested callback's. */
export type FunctionFrame = { node: FunctionNode; rendersJsx: boolean }

type FrameHandlers<Frame extends FunctionFrame> = {
  ruleName: string
  frameFor: (node: FunctionNode) => Frame
  // Called with the frame just popped, so the stack's last frame is the function enclosing it.
  onLeave?: (frame: Frame) => void
}

const COMPONENT_NAME = /^[A-Z]/

/**
 * The visitors that keep `stack` in step with the walk, innermost function last: a frame pushed on
 * entering each function, popped and handed to `onLeave` on leaving it, and marked when JSX renders
 * directly inside it.
 */
export function functionFrameVisitors<Frame extends FunctionFrame>(
  stack: Frame[],
  { ruleName, frameFor, onLeave }: FrameHandlers<Frame>,
): TSESLint.RuleListener {
  const enter = (node: FunctionNode): void => {
    stack.push(frameFor(node))
  }
  const leave = (): void => {
    const frame = stack.pop()
    if (frame === undefined) throw new Error(`${ruleName} left a function it never entered`)
    onLeave?.(frame)
  }
  const markJsx = (): void => {
    const frame = stack.at(-1)
    if (frame !== undefined) frame.rendersJsx = true
  }
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

/** The name of a component: a function named in PascalCase that renders JSX itself. Null for anything else. */
export function componentNameOf(frame: FunctionFrame): string | null {
  const name = functionNameOf(frame.node)
  return name !== null && COMPONENT_NAME.test(name) && frame.rendersJsx ? name : null
}
