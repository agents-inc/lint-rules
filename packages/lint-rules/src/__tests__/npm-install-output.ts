import { namedGroupOf } from '../core/named-groups.ts'

// npm installs a dependency whose peer range leaves out the version installed beside it all the
// same, printing a block that opens with this line and names the package on the next (measured, npm
// 10, eslint-plugin-react 7.37.5 beside ESLint 10).
const PEER_OVERRIDE_OPENING = 'npm warn ERESOLVE overriding peer dependency'
const PACKAGE_RESOLVED_LINE = /^npm warn While resolving: (?<packageName>@?[^@\s]+)@\S+$/u

export function packagesNpmOverridesAPeerFor(installOutput: string): string[] {
  const lines = installOutput.split('\n')
  const packageNames = lines.flatMap((line, index) => (line === PEER_OVERRIDE_OPENING ? [packageResolvedOn(lines[index + 1])] : []))
  return [...new Set(packageNames)].toSorted()
}

function packageResolvedOn(line: string | undefined): string {
  const resolved = line === undefined ? null : PACKAGE_RESOLVED_LINE.exec(line)
  if (resolved === null) throw new Error(`npm opened a peer override without naming the package resolved: ${String(line)}`)
  return namedGroupOf(resolved, 'packageName')
}
