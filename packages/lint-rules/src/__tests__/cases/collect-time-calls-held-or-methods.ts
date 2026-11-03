export const A_THROWING_ARROW_HELD_IN_A_CONST = `import { lookUp } from './helpers.ts'

const lookUpHeld = (id: string) => lookUp(id)

const HELD = lookUpHeld('a')
`

export const A_THROWING_FUNCTION_EXPRESSION_HELD_IN_A_CONST = `import { lookUp } from './helpers.ts'

const lookUpExpressed = function (id: string) {
  return lookUp(id)
}

const EXPRESSED = lookUpExpressed('a')
`

export const A_THROWING_METHOD_CALLED_ON_ITS_OBJECT = `import { lookUp } from './helpers.ts'

const lookUps = {
  byId(id: string) {
    return lookUp(id)
  },
}

const BY_ID = lookUps.byId('a')
`

export const HELD_FUNCTIONS_AND_A_METHOD_THAT_CANNOT_THROW = `const idHeld = (id: string) => id

const idExpressed = function (id: string) {
  return id
}

const ids = {
  byId(id: string) {
    return id
  },
}

const HELD = idHeld('a')
const EXPRESSED = idExpressed('b')
const BY_ID = ids.byId('c')
`
