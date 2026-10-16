const wordsOf = (text: string): string[] => text.split(' ')
export const firstWords = new Set(wordsOf('a b'))
export const secondWords = new Set(wordsOf('c d'))

const lettersOf = (text: string): string[] => text.split('')
export const firstLetters = new Set(lettersOf('ab'))
export const secondLetters = lettersOf('cd')
