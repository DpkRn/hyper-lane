import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
const mockSocketEmit = vi.fn();

vi.mock('./SocketProvider', () => ({
  useSocket: () => ({
    ready: true,
    on: mockSocketOn,
    off: mockSocketOff,
    emit: mockSocketEmit,
  }),
}));

vi.mock('../services/metadataService', () => ({
  initMetadataWorker: vi.fn(),
  saveChunkMetadata: vi.fn(),
}));

const writeChunkToLane = vi.fn(() => Promise.resolve());
const mergeLanesToFinalFile = vi.fn(() => Promise.resolve({}));
const closeAllLanes = vi.fn(() => Promise.resolve());
const initLaneFiles = vi.fn(() => Promise.resolve());

vi.mock('../utils/fileUtils', () => ({
  writeChunkToLane,
  mergeLanesToFinalFile,
  closeAllLanes,
  initLaneFiles,
}));

import { WebRTCProvider, useWebRTC } from './WebRTCProvider';

class MockDataChannel {
  constructor(label) {
    this.label = label;
    this.onopen = null;
    this.onmessage = null;
  }
}

class MockRTCPeerConnection {
  constructor() {
    this.onicecandidate = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    globalThis.__lastPeerConnection = this;
  }

  async createOffer() {
    return {};
  }

  async setLocalDescription() {}

  async setRemoteDescription() {}

  async createAnswer() {
    return {};
  }

  async addIceCandidate() {}
}

describe('WebRTCProvider', () => {
  beforeEach(() => {
    globalThis.__lastPeerConnection = undefined;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setupReceiverLane calls onProgress callback with correct bytes received", async () => {
    const onProgress = vi.fn();

    function TestComponent() {
      const { startWebRTC } = useWebRTC();

      React.useEffect(() => {
        startWebRTC(
          { name: 'test.bin', size: 1024 * 1024, type: 'application/octet-stream' },
          'session-1',
          'receiver',
          onProgress,
        );
      }, [startWebRTC]);

      return null;
    }

    render(
      <WebRTCProvider>
        <TestComponent />
      </WebRTCProvider>,
    );

    const peer = globalThis.__lastPeerConnection;
    expect(peer).toBeTruthy();

    const channel = new MockDataChannel('lane-0');

    // Trigger the provider's ondatachannel handler, which wires up the receiver lane
    peer.ondatachannel({ channel });

    const payload = new ArrayBuffer(2048);

    await act(async () => {
      await channel.onmessage({ data: payload });
    });

    expect(onProgress).toHaveBeenCalledWith(payload.byteLength);
  });
});
