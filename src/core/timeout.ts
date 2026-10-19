export type DependencyResult<T> =
  | { status: 'ok'; value: T; latencyMs: number }
  | { status: 'timeout' | 'error' | 'skipped'; latencyMs: number };

export function skipped<T>(): DependencyResult<T> {
  return { status: 'skipped', latencyMs: 0 };
}

/**
 * Calls a dependency with a hard deadline and never throws. The abort signal is passed through so real clients can cancel 
 * the in-flight request.
 */
export async function callWithTimeout<T>(
  call: (abort: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<DependencyResult<T>> {
  const startedAt = performance.now();
  const latencyMs = () => Math.round(performance.now() - startedAt);
  const abort = AbortSignal.timeout(timeoutMs);
  const deadline = new Promise<never>((_, reject) => {
    abort.addEventListener('abort', () => reject(abort.reason), { once: true });
  });

  try {
    const value = await Promise.race([call(abort), deadline]);
    return { status: 'ok', value, latencyMs: latencyMs() };
  } catch {
    return { status: abort.aborted ? 'timeout' : 'error', latencyMs: latencyMs() };
  }
}
