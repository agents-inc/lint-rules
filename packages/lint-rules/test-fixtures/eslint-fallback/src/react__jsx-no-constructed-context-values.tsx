import { createContext } from 'react';
const Ctx = createContext<object | null>(null);
export const App = () => <Ctx.Provider value={{ a: 1 }} />;
