const SIMULATED_LATENCY_MS = 600

/**
 * Demo only: slows every save so the optimistic update is visible, and can
 * fail it on demand so the rollback is too. Delete this for production use.
 */
export async function simulateNetwork(isOutage: boolean): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS))
  if (isOutage) throw new Error('Simulated outage')
}
