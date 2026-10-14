declare const p: Promise<number>;
declare const callback: (e: unknown) => void;
p.then(() => callback(null));
