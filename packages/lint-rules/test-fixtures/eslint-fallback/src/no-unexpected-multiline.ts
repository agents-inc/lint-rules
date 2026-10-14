const bar = () => () => 1;
const foo = bar
(1 || 2).toString();
