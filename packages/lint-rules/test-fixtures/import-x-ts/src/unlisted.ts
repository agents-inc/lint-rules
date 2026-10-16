// import-x/no-extraneous-dependencies, through a package that ships types alone, which the package.json does not list.
import { value } from 'types-unlisted'
export const v = value
