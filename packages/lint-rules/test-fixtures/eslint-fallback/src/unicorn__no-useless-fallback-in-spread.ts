declare const a: object | undefined;
export const o = { ...(a || {}) };
