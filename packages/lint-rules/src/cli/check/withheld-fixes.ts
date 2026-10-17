import withheld from './withheld-fixes.json' with { type: 'json' }

/** Rule ID → why. The rule still reports; the agent fixes it by hand. */
export const WITHHELD_FIXES: ReadonlyMap<string, string> = new Map(Object.entries(withheld))
