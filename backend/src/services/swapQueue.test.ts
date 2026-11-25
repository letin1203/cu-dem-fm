import { describe, expect, it } from 'vitest';
import {
  findSwapQueueBlocker,
  orderSwapQueue,
  swapQueueBlockMessage,
} from './swapQueue';

const request = (id: string, createdAt: string) => ({
  id,
  requesterPlayerId: `player-${id}`,
  requesterName: `Player ${id}`,
  createdAt: new Date(createdAt),
});

describe('orderSwapQueue', () => {
  it('sorts oldest first', () => {
    const queue = orderSwapQueue([
      request('c', '2026-11-24T10:30:00Z'),
      request('a', '2026-11-24T10:00:00Z'),
      request('b', '2026-11-24T10:15:00Z'),
    ]);

    expect(queue.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [
      request('b', '2026-11-24T10:15:00Z'),
      request('a', '2026-11-24T10:00:00Z'),
    ];
    orderSwapQueue(input);

    expect(input.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('keeps registration order for identical timestamps', () => {
    const same = '2026-11-24T10:00:00Z';
    const queue = orderSwapQueue([request('a', same), request('b', same)]);

    expect(queue.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('findSwapQueueBlocker', () => {
  it('allows the head of the queue', () => {
    const queue = [
      request('a', '2026-11-24T10:00:00Z'),
      request('b', '2026-11-24T10:15:00Z'),
    ];

    expect(findSwapQueueBlocker(queue, 'a')).toEqual({ block: false });
  });

  it('blocks anyone behind the head', () => {
    const queue = [
      request('a', '2026-11-24T10:00:00Z'),
      request('b', '2026-11-24T10:15:00Z'),
    ];

    const result = findSwapQueueBlocker(queue, 'b');
    expect(result.block).toBe(true);
    expect(result.block && result.head.id).toBe('a');
  });

  it('allows a lone request', () => {
    expect(findSwapQueueBlocker([request('a', '2026-11-24T10:00:00Z')], 'a'))
      .toEqual({ block: false });
  });

  it('does not block when the queue is empty', () => {
    // The request may have been resolved concurrently; the caller's own status
    // checks then report the real problem.
    expect(findSwapQueueBlocker([], 'a')).toEqual({ block: false });
  });
});

describe('swapQueueBlockMessage', () => {
  it('names the player who must be served first', () => {
    expect(swapQueueBlockMessage('An')).toContain('An');
    expect(swapQueueBlockMessage('An')).toContain('sớm nhất');
  });
});
