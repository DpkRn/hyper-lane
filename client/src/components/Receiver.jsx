import React, { useState, useEffect } from 'react';
import { Download, FileText, Loader2, Check, Pause, Play, RotateCcw, FolderOpen } from 'lucide-react';

const Receiver = () => {
  const [connecting, setConnecting] = useState(true);
  const [fileInfo, setFileInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [channels, setChannels] = useState([
    { id: 1, progress: 0, received: 0, total: 0, status: 'idle' },
    { id: 2, progress: 0, received: 0, total: 0, status: 'idle' },
    { id: 3, progress: 0, received: 0, total: 0, status: 'idle' },
    { id: 4, progress: 0, received: 0, total: 0, status: 'idle' }
  ]);
  const [totalProgress, setTotalProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saveDirectory, setSaveDirectory] = useState(null);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    return <FileText className="w-16 h-16 text-indigo-400" />;
  };

  const handleDownload = () => {
    setDownloading(true);
  };

  const handleOpenDirectoryPicker = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });
        setSaveDirectory(directoryHandle);
        setDownloading(true);
      } else {
        alert('Directory Picker API is not supported in your browser.');
        setDownloading(true);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error opening directory picker:', err);
      }
    }
  };

  // Simulate connection and file info retrieval
  useEffect(() => {
    setTimeout(() => {
      setConnecting(false);
      setFileInfo({
        name: 'presentation.pdf',
        size: 15728640, // 15 MB
        type: 'application/pdf'
      });
    }, 1500);
  }, []);

  // Simulate download progress
  useEffect(() => {
    if (downloading && !paused) {
      const interval = setInterval(() => {
        setChannels(prev => prev.map(ch => {
          if (ch.progress < 100) {
            const newProgress = Math.min(ch.progress + Math.random() * 5, 100);
            const newReceived = (newProgress / 100) * ch.total;
            return { ...ch, progress: newProgress, received: newReceived, status: 'receiving' };
          }
          return { ...ch, status: 'completed' };
        }));
      }, 100);

      return () => clearInterval(interval);
    } else if (paused) {
      setChannels(prev => prev.map(ch => ({
        ...ch,
        status: ch.progress < 100 ? 'paused' : 'completed'
      })));
    }
  }, [downloading, paused]);

  useEffect(() => {
    if (fileInfo && downloading) {
      const sliceSize = fileInfo.size / 4;
      setChannels(prev => prev.map((ch, i) => ({
        ...ch,
        total: sliceSize,
        received: 0
      })));
    }
  }, [fileInfo, downloading]);

  useEffect(() => {
    const total = channels.reduce((sum, ch) => sum + ch.progress, 0) / 4;
    setTotalProgress(total);
    
    if (total >= 100 && downloading) {
      setCompleted(true);
    }
  }, [channels, downloading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Receive File</h1>
              <p className="text-gray-500 mt-1">Download file via peer-to-peer</p>
            </div>
            <Download className="w-10 h-10 text-purple-600" />
          </div>

          {/* Connecting State */}
          {connecting && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-16 h-16 text-purple-500 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-700">Connecting to sender...</p>
              <p className="text-sm text-gray-500 mt-2">Establishing peer connection</p>
            </div>
          )}

          {/* File Info and Download */}
          {!connecting && fileInfo && !downloading && (
            <div className="space-y-6">
              <div className="bg-purple-50 rounded-xl p-8 border border-purple-200">
                <div className="flex items-start gap-6">
                  {getFileIcon()}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                      {fileInfo.name}
                    </h2>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        <span className="font-medium">Size:</span> {formatBytes(fileInfo.size)}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Type:</span> {fileInfo.type}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">
                  Connected to sender. Ready to download.
                </p>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" />
                Download to Default Location
              </button>

              <div className="text-center">
                <span className="text-gray-500">or</span>
              </div>

              <button
                onClick={handleOpenDirectoryPicker}
                className="w-full py-4 bg-purple-100 text-purple-700 rounded-xl font-semibold text-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-3"
              >
                <FolderOpen className="w-5 h-5" />
                Choose Download Location
              </button>
            </div>
          )}

          {/* Download Progress */}
          {downloading && (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-gray-800">Download Progress</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {totalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 rounded-full"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-600">
                    {formatBytes(channels.reduce((sum, ch) => sum + ch.received, 0))} / {formatBytes(fileInfo.size)}
                  </p>
                  {saveDirectory && (
                    <p className="text-xs text-purple-600 font-medium">
                      📁 Saving to: {saveDirectory.name}
                    </p>
                  )}
                </div>
              </div>

              {/* File Info */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="font-semibold text-gray-800">{fileInfo.name}</p>
                <p className="text-sm text-gray-600 mt-1">{formatBytes(fileInfo.size)}</p>
              </div>

              {/* Individual Channels */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 text-lg">Receiving Lanes</h3>
                  <div className="flex gap-2">
                    {!paused && totalProgress < 100 && (
                      <button
                        onClick={() => setPaused(true)}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    )}
                    {paused && totalProgress < 100 && (
                      <button
                        onClick={() => setPaused(false)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    )}
                  </div>
                </div>
                {channels.map((channel) => (
                  <div key={channel.id} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          channel.status === 'completed' ? 'bg-green-500' :
                          channel.status === 'receiving' ? 'bg-purple-500 animate-pulse' :
                          channel.status === 'paused' ? 'bg-amber-500' :
                          'bg-gray-300'
                        }`} />
                        <span className="font-medium text-gray-700">Lane {channel.id}</span>
                        {channel.status === 'paused' && (
                          <span className="text-xs text-amber-600 font-medium">PAUSED</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-600">
                        {channel.progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${channel.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(channel.received)} / {formatBytes(channel.total)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Download Speed (optional enhancement) */}
              {!completed && !paused && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Average Speed</span>
                    <span className="text-sm font-semibold text-blue-600">
                      ~{(Math.random() * 5 + 2).toFixed(1)} MB/s
                    </span>
                  </div>
                </div>
              )}

              {/* Paused Status */}
              {paused && !completed && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                  <Pause className="w-5 h-5 text-amber-600" />
                  <p className="text-amber-800 font-medium">
                    Download paused. Click Resume to continue.
                  </p>
                </div>
              )}

              {/* Completion */}
              {completed && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-xl font-semibold text-green-800">Download Complete!</p>
                  <p className="text-green-600 mt-1">File saved to your downloads</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Open File
                    </button>
                    <button
                      onClick={() => {
                        setDownloading(false);
                        setPaused(false);
                        setCompleted(false);
                        setChannels([
                          { id: 1, progress: 0, received: 0, total: 0, status: 'idle' },
                          { id: 2, progress: 0, received: 0, total: 0, status: 'idle' },
                          { id: 3, progress: 0, received: 0, total: 0, status: 'idle' },
                          { id: 4, progress: 0, received: 0, total: 0, status: 'idle' }
                        ]);
                        setTotalProgress(0);
                      }}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Receive Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Receiver;