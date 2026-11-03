import type { ProcessResult } from '../config-file-loads.ts'

/** A run that exited 0 and printed nothing, unless given. */
export function buildProcessResult(fields: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout: '', stderr: '', ...fields }
}
