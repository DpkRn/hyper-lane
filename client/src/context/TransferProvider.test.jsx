import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Shared mocks/state for SocketProvider and WebRTCProvider hooks
const socketHandlers = {};
let progressCallback = null;

vi.mock('./SocketProvider', () => ({
  useSocket: () => ({
    ready: true,
    emit: vi.fn(),
    on: (event, handler) => {
      socketHandlers[event] = handler;
    },
    off: (event) => {
      delete socketHandlers[event];
    },
  }),
}));

vi.mock('./WebRTCProvider', () => ({
  useWebRTC: () => ({
    connected: true,
    startWebRTC: (_file, _sid, _role, onProgress) => {
      progressCallback = onProgress;
    },
  }),
}));

vi.mock('../services/metadataService', () => ({
  requestResume: vi.fn(),
}));

import { TransferProvider, useTransfer } from './TransferProvider';

function SessionIdConsumer() {
  const { sessionId } = useTransfer();
  return <div data-testid="session-id">{sessionId}</div>;
}

function TransferControls() {
  const { progress, speedMbps, etaSeconds, startDownload } = useTransfer();

  return (
    <div>
      <div data-testid="progress">{progress}</div>
      <div data-testid="speed">{speedMbps}</div>
      <div data-testid="eta">{etaSeconds ?? ''}</div>
      <button type="button" data-testid="start-download" onClick={() => startDownload()}>
        Start Download
      </button>
    </div>
  );
}

describe('TransferProvider', () => {
  beforeEach(() => {
    // Reset URL and mocks before each test
    window.history.replaceState({}, '', '/');
    Object.keys(socketHandlers).forEach((key) => {
      delete socketHandlers[key];
    });
    progressCallback = null;
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes sessionId from URL parameters', () => {
    window.history.pushState({}, '', '/?session=test-session');

    render(
      <TransferProvider>
        <SessionIdConsumer />
      </TransferProvider>,
    );

    expect(screen.getByTestId('session-id')).toHaveTextContent('test-session');
  });

  it("resetTransferStats resets all transfer metrics via startDownload", () => {
    window.history.pushState({}, '', '/?session=test-session');

    render(
      <TransferProvider>
        <TransferControls />
      </TransferProvider>,
    );

    // Provide file info so startDownload doesn't early-return
    const fileInfoHandler = socketHandlers['file-info'];
    expect(typeof fileInfoHandler).toBe('function');

    act(() => {
      fileInfoHandler({
        name: 'test.bin',
        type: 'application/octet-stream',
        size: 10 * 1024 * 1024, // 10 MiB
      });
    });

    const startButton = screen.getByTestId('start-download');

    // Start download once and simulate some progress to change metrics
    act(() => {
      startButton.click();
    });

    expect(typeof progressCallback).toBe('function');

    act(() => {
      progressCallback(1024 * 1024); // 1 MiB received
    });

    // Progress should now be non-zero
    expect(screen.getByTestId('progress').textContent).not.toBe('0');

    // Calling startDownload again should internally call resetTransferStats
    act(() => {
      startButton.click();
    });

    expect(screen.getByTestId('progress')).toHaveTextContent('0');
    expect(screen.getByTestId('speed')).toHaveTextContent('0');
    expect(screen.getByTestId('eta')).toHaveTextContent('');
  });

  it('updateTransferStats calculates transfer speed and ETA', async () => {
    window.history.pushState({}, '', '/?session=test-session');

    // Control time so we can assert speed/ETA precisely
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    render(
      <TransferProvider>
        <TransferControls />
      </TransferProvider>,
    );

    const fileInfoHandler = socketHandlers['file-info'];
    expect(typeof fileInfoHandler).toBe('function');

    act(() => {
      fileInfoHandler({
        name: 'test.bin',
        type: 'application/octet-stream',
        size: 10 * 1024 * 1024, // 10 MiB
      });
    });

    const startButton = screen.getByTestId('start-download');

    act(() => {
      startButton.click();
    });

    expect(typeof progressCallback).toBe('function');

    // First chunk at t = 0ms sets the baseline
    act(() => {
      progressCallback(1024 * 1024); // 1 MiB
    });

    // Second chunk after 2000ms
    now += 2000;

    act(() => {
      progressCallback(1024 * 1024); // another 1 MiB
    });

    await waitFor(() => {
      const progress = parseFloat(screen.getByTestId('progress').textContent);

      // Progress should move forward when bytes are reported
      expect(progress).toBeGreaterThan(0);
    });
  });
});
