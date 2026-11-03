import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function writeFileCreatingItsDir(path: string, contents: string): Promise<void> {
  // eslint-disable-next-line functional/no-expression-statements -- without it the write after it fails with ENOENT where the folder is missing; what mkdir answers, the first folder it made, is read by nothing
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}
