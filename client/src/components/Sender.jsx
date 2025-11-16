import React, { useState, useEffect } from 'react';
import { Upload, Send, Link2, Users, Check, Pause, Play, RotateCcw } from 'lucide-react';

const Sender = () => {
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [receiverConnected, setReceiverConnected] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [paused, setPaused] = useState(false);
  const [channels, setChannels] = useState([
    { id: 1, progress: 0, sent: 0, total: 0, status: 'idle' },
    { id: 2, progress: 0, sent: 0, total: 0, status: 'idle' },
    { id: 3, progress: 0, sent: 0, total: 0, status: 'idle' },
    { id: 4, progress: 0, sent: 0, total: 0, status: 'idle' }
  ]);
  const [totalProgress, setTotalProgress] = useState(0);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      try {
        setFile(selectedFile);
        
        // Generate session ID and create share link
        const id = Math.random().toString(36).substring(7);
        setSessionId(id);
        setShareLink(`${window.location.origin}?session=${id}`);
      } catch (err) {
        console.error('Error selecting file:', err);
      }
    }
  };

  const handleOpenFilePicker = async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'All Files',
              accept: {'*/*': ['*']}
            }
          ],
          multiple: false
        });
        
        const file = await fileHandle.getFile();
        setFile(file);
        
        // Generate session ID and create share link
        const id = Math.random().toString(36).substring(7);
        setSessionId(id);
        setShareLink(`${window.location.origin}?session=${id}`);
      } else {
        alert('File System Access API is not supported in your browser. Please use the file input.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error opening file picker:', err);
      }
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  // Simulate receiver connection
  useEffect(() => {
    if (sessionId) {
      setTimeout(() => setReceiverConnected(true), 2000);
    }
  }, [sessionId]);

  // Simulate transfer progress
  useEffect(() => {
    if (transferring && !paused) {
      const interval = setInterval(() => {
        setChannels(prev => prev.map(ch => {
          if (ch.progress < 100) {
            const newProgress = Math.min(ch.progress + Math.random() * 5, 100);
            const newSent = (newProgress / 100) * ch.total;
            return { ...ch, progress: newProgress, sent: newSent, status: 'sending' };
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
  }, [transferring, paused]);

  useEffect(() => {
    if (file && transferring) {
      const sliceSize = file.size / 4;
      setChannels(prev => prev.map((ch, i) => ({
        ...ch,
        total: sliceSize,
        sent: 0
      })));
    }
  }, [file, transferring]);

  useEffect(() => {
    const total = channels.reduce((sum, ch) => sum + ch.progress, 0) / 4;
    setTotalProgress(total);
  }, [channels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Send File</h1>
              <p className="text-gray-500 mt-1">Share files directly with WebRTC</p>
            </div>
            <Send className="w-10 h-10 text-indigo-600" />
          </div>

          {/* File Upload */}
          {!file && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 rounded-xl p-12 cursor-pointer hover:border-indigo-500 transition-colors bg-indigo-50/50">
                <Upload className="w-16 h-16 text-indigo-400 mb-4" />
                <span className="text-lg font-medium text-gray-700 mb-2">
                  Choose a file to share
                </span>
                <span className="text-sm text-gray-500">Click or drag and drop</span>
                <input type="file" className="hidden" onChange={handleFileSelect} />
              </label>
              
              <div className="text-center">
                <span className="text-gray-500">or</span>
              </div>
              
              <button
                onClick={handleOpenFilePicker}
                className="w-full py-3 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
              >
                Open File Picker (File System API)
              </button>
            </div>
          )}

          {/* File Selected */}
          {file && !transferring && (
            <div className="space-y-6">
              <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">{file.name}</p>
                    <p className="text-gray-600 mt-1">{formatBytes(file.size)}</p>
                  </div>
                  <Check className="w-8 h-8 text-green-500" />
                </div>
              </div>

              {/* Share Link */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-mono text-sm"
                  />
                  <button
                    onClick={copyLink}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center justify-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <Users className={`w-5 h-5 ${receiverConnected ? 'text-green-500' : 'text-amber-500'}`} />
                <span className="font-medium text-gray-700">
                  {receiverConnected ? 'Receiver connected! Ready to send.' : 'Waiting for receiver...'}
                </span>
              </div>

              {receiverConnected && (
                <button
                  onClick={() => setTransferring(true)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Start Transfer
                </button>
              )}
            </div>
          )}

          {/* Transfer Progress */}
          {transferring && (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-gray-800">Total Progress</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {totalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {formatBytes(channels.reduce((sum, ch) => sum + ch.sent, 0))} / {formatBytes(file.size)}
                </p>
              </div>

              {/* Individual Channels */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 text-lg">Transfer Lanes</h3>
                  <div className="flex gap-2">
                    {!paused && totalProgress < 100 && (
                      <button
                        onClick={() => setPaused(true)}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    )}
                    {paused && totalProgress < 100 && (
                      <button
                        onClick={() => setPaused(false)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
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
                          channel.status === 'sending' ? 'bg-blue-500 animate-pulse' :
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
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${channel.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(channel.sent)} / {formatBytes(channel.total)}
                    </p>
                  </div>
                ))}
              </div>

              {totalProgress >= 100 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-xl font-semibold text-green-800">Transfer Complete!</p>
                  <p className="text-green-600 mt-1">File sent successfully</p>
                  <button
                    onClick={() => {
                      setTransferring(false);
                      setPaused(false);
                      setChannels([
                        { id: 1, progress: 0, sent: 0, total: 0, status: 'idle' },
                        { id: 2, progress: 0, sent: 0, total: 0, status: 'idle' },
                        { id: 3, progress: 0, sent: 0, total: 0, status: 'idle' },
                        { id: 4, progress: 0, sent: 0, total: 0, status: 'idle' }
                      ]);
                      setTotalProgress(0);
                    }}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Send Another File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sender;