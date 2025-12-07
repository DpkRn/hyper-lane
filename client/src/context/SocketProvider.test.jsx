import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('socket.io-client', () => ({
  default: vi.fn(() => ({
    on: mockOn,
    off: mockOff,
    disconnect: mockDisconnect,
  })),
}));

import { SocketProvider, useSocket } from './SocketProvider';

let latestOn;
let latestOff;

function CaptureHooks() {
  const { on, off } = useSocket();

  React.useEffect(() => {
    latestOn = on;
    latestOff = off;
  }, [on, off]);

  return null;
}

describe('SocketProvider', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockOff.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("off removes a registered event listener", async () => {
    const handler = vi.fn();

    render(
      <SocketProvider>
        <CaptureHooks />
      </SocketProvider>,
    );

    await waitFor(() => {
      expect(typeof latestOn).toBe('function');
      expect(typeof latestOff).toBe('function');
    });

    // Call through the exposed wrappers
    latestOn('test-event', handler);
    latestOff('test-event', handler);

    expect(mockOn).toHaveBeenCalledWith('test-event', handler);
    expect(mockOff).toHaveBeenCalledWith('test-event', handler);
  });
});
