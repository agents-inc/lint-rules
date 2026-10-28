/** `under` with each piece laid over it in turn: a later piece's value for a key replaces an earlier one's. */
export function laidOver<Piece extends object>(under: Readonly<Piece>, [first, ...rest]: ReadonlyArray<Readonly<Piece>>): Readonly<Piece> {
  return first === undefined ? under : laidOver({ ...under, ...first }, rest)
}
