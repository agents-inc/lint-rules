declare function read(cb: (err: unknown, data: string) => void): void;
read((err, data) => {
  Promise.resolve(data).then(() => undefined);
});
