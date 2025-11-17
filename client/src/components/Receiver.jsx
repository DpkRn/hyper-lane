import React from "react";
import { Download, Check, FolderOpen, Pause, Play } from "lucide-react";
import { useTransfer } from "../context/TransferProvider";

const Receiver = () => {
  const {
    fileInfo,
    progress,
    speedMbps,
    etaSeconds,
    status,
    startDownload,
    pause,
    resume
  } = useTransfer();

  const formatBytes = (bytes) => {
    if (!bytes) return "0 Bytes";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="max-w-3xl mx-auto bg-white shadow-xl p-8 rounded-2xl">

        {/* Waiting for metadata */}
        {!fileInfo && (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">Waiting for sender...</p>
          </div>
        )}

        {/* File Info Received */}
        {fileInfo && status === "idle" && (
          <div className="space-y-6">
            <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
              <h2 className="text-xl font-semibold">{fileInfo.name}</h2>
              <p className="text-gray-600">{formatBytes(fileInfo.size)}</p>
            </div>

            <button
              onClick={startDownload}
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download
            </button>
          </div>
        )}

        {/* Download In Progress */}
        {status === "transferring" && (
          <div className="space-y-6">
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-300">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-800">Receiving</span>
                <span className="text-2xl font-bold text-purple-600">{progress}%</span>
              </div>

              <div className="bg-gray-200 h-4 rounded-full mt-3">
                <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>

              <p className="text-sm text-gray-600 mt-2">
                {speedMbps} MB/s — ETA: {etaSeconds ?? "Calculating…"}s
              </p>
            </div>

            <button onClick={pause} className="w-full py-3 bg-amber-500 text-white rounded-lg">
              <Pause className="w-5 h-5 inline-block mr-2" /> Pause
            </button>
          </div>
        )}

        {/* Paused */}
        {status === "paused" && (
          <button onClick={resume} className="w-full py-3 bg-green-500 text-white rounded-lg">
            <Play className="inline-block w-5 h-5 mr-2" /> Resume
          </button>
        )}

        {/* Finished */}
        {status === "completed" && (
          <div className="bg-green-50 p-6 text-center rounded-xl">
            <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-800">Download Complete!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receiver;
