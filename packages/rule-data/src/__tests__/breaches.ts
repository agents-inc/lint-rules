/** A way a subject can break what is guaranteed of it: what is wrong, and the subjects it is wrong of. */
export type Breach<Subject> = readonly [wrong: string, breaks: (subject: Subject) => boolean]

export function breachesOf<Subject>(subject: Subject, breaches: ReadonlyArray<Breach<Subject>>): string[] {
  return breaches.filter(([, breaks]) => breaks(subject)).map(([wrong]) => wrong)
}
