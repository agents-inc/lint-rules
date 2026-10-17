export type PeerOverride = { readonly packageName: string; readonly version: string; readonly peerRange: string }

const PEER = 'eslint'
const PEER_INSTALLED = '10.12.0'
const DEPENDENT = 'wrap@1.0.0'

/** The block npm prints for a peer it overrides, as npm 10 printed it for eslint-plugin-react 7.37.5 beside ESLint 10. */
export function buildNpmPeerOverrideWarning({ packageName, version, peerRange }: PeerOverride): string {
  return [
    'npm warn ERESOLVE overriding peer dependency',
    `npm warn While resolving: ${packageName}@${version}`,
    `npm warn Found: ${PEER}@${PEER_INSTALLED}`,
    `npm warn node_modules/${PEER}`,
    `npm warn   dev ${PEER}@"${PEER_INSTALLED}" from the root project`,
    'npm warn',
    'npm warn Could not resolve dependency:',
    `npm warn peer ${PEER}@"${peerRange}" from ${packageName}@${version}`,
    `npm warn node_modules/${packageName}`,
    `npm warn   ${packageName}@"${version}" from ${DEPENDENT}`,
  ].join('\n')
}

/** A peer override's opening line followed by a line other than the one naming the package resolved. */
export function buildNpmPeerOverrideNamingNoPackage(): string {
  return ['npm warn ERESOLVE overriding peer dependency', `npm warn Found: ${PEER}@${PEER_INSTALLED}`].join('\n')
}

/** What npm prints once it has installed, after any warning. */
export function buildNpmInstalledSummary(packageCount: number): string {
  return `\nadded ${String(packageCount)} packages in 3s\n`
}
