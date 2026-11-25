/**
 * Swap queue rules.
 *
 * Weekly swaps are first-come-first-served: a player who registered a swap
 * earlier must be served before anyone who registered later. Without this a
 * newcomer could keep picking the newest request and starve the players who
 * have been waiting longest.
 */

export interface QueuedSwapRequest {
  id: string;
  requesterPlayerId: string;
  requesterName: string;
  createdAt: Date;
}

/** Requests in the order they will be served. */
export const orderSwapQueue = <T extends { createdAt: Date }>(requests: T[]): T[] =>
  [...requests].sort(
    (first, second) => first.createdAt.getTime() - second.createdAt.getTime(),
  );

/**
 * Whether `requestId` may be accepted right now.
 *
 * Returns the blocking request when it may not, so callers can name the player
 * who is actually next instead of a generic error.
 */
export const findSwapQueueBlocker = <T extends { id: string }>(
  queue: T[],
  requestId: string,
): { block: false } | { block: true; head: T } => {
  const head = queue[0];
  // An empty queue means the request was already consumed elsewhere; let the
  // caller's own status checks decide what to report.
  if (!head) return { block: false };
  return head.id === requestId ? { block: false } : { block: true, head };
};

/** Human-readable reason shown when a request is not yet servable. */
export const swapQueueBlockMessage = (headName: string): string =>
  `Vui lòng swap với ${headName} — người đăng ký swap sớm nhất.`;
