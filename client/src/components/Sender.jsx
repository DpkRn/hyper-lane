import React, { useRef } from 'react';
import { Upload, Send, Link2, Users, Check, Pause, Play, RotateCcw } from 'lucide-react';
import { useTransfer } from "../context/TransferProvider";

const Sender = () => {
  const fileInputRef = useRef(null);

  // Pull live state + actions from TransferProvider
  const {
    fileInfo,
    progress,
    speedMbps,
    etaSeconds,
    receiverJoined,
    sessionId,
    status,
    startSender,
    startTransfer,
    pause,
    resume,
    cancel
  } = useTransfer();

  const shareLink = sessionId ? `${window.location.origin}/receiver?session=${sessionId}` : "";

  const formatBytes = (bytes) => {
    if (!bytes) return "0 Bytes";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  function onFileSelect(e) {
    const file = e.target.files[0];
    if (file) startSender(file);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Send File</h1>
            <p className="text-gray-500">Share peer-to-peer securely</p>
          </div>
          <Send className="w-10 h-10 text-indigo-600" />
        </div>

        {/* Step 1: Choose File */}
        {!fileInfo && (
          <div className="space-y-4">
            <label className="cursor-pointer border-dashed border-2 rounded-xl p-12 flex flex-col items-center hover:bg-indigo-50 transition">
              <Upload className="w-16 h-16 text-indigo-400 mb-4" />
              <span className="text-lg font-medium text-gray-700">Choose a file</span>
              <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelect} />
            </label>
          </div>
        )}

        {/* Step 2: File Ready */}
        {fileInfo && status === "idle" && (
          <div className="space-y-6">

            {/* File Details */}
            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200">
              <p className="font-semibold text-gray-800 text-lg">{fileInfo.name}</p>
              <p className="text-gray-600">{formatBytes(fileInfo.size)}</p>
            </div>

            {/* Share Link */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Share Link</label>
              <div className="flex gap-2">
                <input value={shareLink} readOnly className="flex-1 px-4 py-3 border rounded-lg text-gray-700 font-mono" />
                <button className="px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  onClick={() => navigator.clipboard.writeText(shareLink)}>
                  <Link2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Receiver Status */}
            <div className="flex items-center p-4 rounded-lg border bg-amber-50">
              <Users className={`w-5 h-5 ${receiverJoined ? "text-green-500" : "text-amber-500"}`} />
              <span className="ml-3 font-medium">
                {receiverJoined ? "Receiver connected!" : "Waiting for receiver..."}
              </span>
            </div>

            {receiverJoined && (
              <button
                onClick={startTransfer}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg hover:bg-indigo-700"
              >
                Start Transfer
              </button>
            )}
          </div>
        )}

        {/* Step 3: Transfer UI */}
        {status === "transferring" && (
          <div className="space-y-6">

            {/* Progress */}
            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">Progress</span>
                <span className="text-2xl font-bold text-indigo-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 mt-3">
                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {speedMbps} MB/s — ETA: {etaSeconds ? `${etaSeconds}s` : "Calculating…"}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button onClick={pause} className="flex-1 py-3 bg-amber-500 text-white rounded-lg">Pause</button>
              <button onClick={cancel} className="flex-1 py-3 bg-gray-300 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {status === "paused" && (
          <button onClick={resume} className="w-full py-4 bg-green-600 text-white rounded-xl">
            <Play className="w-5 h-5 inline mr-2" /> Resume
          </button>
        )}
      </div>
    </div>
  );
};

export default Sender;
