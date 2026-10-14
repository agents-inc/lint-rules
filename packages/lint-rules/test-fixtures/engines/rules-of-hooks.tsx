import { useState } from 'react'
export const getThing = async (id: number) => {
  const [v] = useState(0)
  return v + id
}
