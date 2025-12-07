import React from 'react';
import { render } from '@testing-library/react';
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

function TestComponent({ handler }) {
  const { on, off } = useSocket();

  React.useEffect(() => {
    on('test-event', handler);
    off('test-event', handler);
  }, [on, off, handler]);

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

  it("off removes a registered event listener", () => {
    const handler = vi.fn();

    render(
      <SocketProvider>
        <TestComponent handler={handler} />
      </SocketProvider>,
    );

    expect(mockOn).toHaveBeenCalledWith('test-event', handler);
    expect(mockOff).toHaveBeenCalledWith('test-event', handler);
  });
});
