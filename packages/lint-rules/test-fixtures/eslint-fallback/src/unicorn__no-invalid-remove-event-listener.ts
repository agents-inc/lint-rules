declare const el: EventTarget;
declare const fn: () => void;
el.removeEventListener('click', fn.bind(el));
