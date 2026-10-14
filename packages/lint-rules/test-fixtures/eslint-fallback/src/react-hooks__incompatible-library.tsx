import { useForm } from 'react-hook-form';
export function App() {
  const { watch } = useForm();
  return <div>{String(watch('a'))}</div>;
}
