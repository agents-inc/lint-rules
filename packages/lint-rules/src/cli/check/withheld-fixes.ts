import withheld from './withheld-fixes.json' with { type: 'json' }

/**
 * The rules whose fixes check never applies, rule ID → why (spec-cli.md X2, the gate's
 * NO_AUTOFIX): the rule still reports, and the agent fixes it by hand. Kept as data beside check
 * until rule-data carries it.
 */
export const WITHHELD_FIXES: ReadonlyMap<string, string> = new Map(Object.entries(withheld))
