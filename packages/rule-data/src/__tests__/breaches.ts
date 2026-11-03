/** A way a subject can break what is guaranteed of it: what is wrong, and the subjects it is wrong of. */
export type Breach<Subject> = readonly [wrong: string, breaks: (subject: Subject) => boolean]

/** A card: a question the owner answers, `q-` and lower-case words joined by hyphens. */
const QUESTION_CARD = /^q-[\da-z]+(?:-[\da-z]+)*$/u

export function breachesOf<Subject>(subject: Subject, breaches: ReadonlyArray<Breach<Subject>>): string[] {
  return breaches.filter(([, breaks]) => breaks(subject)).map(([wrong]) => wrong)
}

export function heldForNoCard(heldBy: string): Breach<unknown> {
  return [`is held for "${heldBy}", which is no card`, () => !QUESTION_CARD.test(heldBy)]
}
