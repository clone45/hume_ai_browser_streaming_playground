'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';
import { AudioWaveform } from '@/components/AudioWaveform';
import { 
  Mic, 
  Plug, 
  Volume2, 
  StopCircle, 
  Play, 
  Loader2, 
  Bug, 
  Copy, 
  Trash2,
  Shield,
  Globe,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  AudioWaveform as WaveformIcon,
  Activity,
  Clock,
  Database
} from 'lucide-react';

export default function TTSPlayground() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  
  // TTS state
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [audioAnalytics, setAudioAnalytics] = useState<any>(null);
  
  // Debug state
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Waveform state
  const [audioDataChunks, setAudioDataChunks] = useState<ArrayBuffer[]>([]);
  
  // Refs
  const audioStreamerRef = useRef<WebAudioStreamer | null>(null);
  const wsRef = useRef<WebSocket>();
  
  // Add debug message (define this first) - oldest first
  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
  }, []);
  
  // Initialize Web Audio streamer once
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioStreamerRef.current = new WebAudioStreamer(
        setIsPlayingAudio,
        addDebugMessage // Pass logging callback
      );
    }
    
    // Update analytics and waveform data periodically
    const analyticsInterval = setInterval(() => {
      if (audioStreamerRef.current) {
        const status = audioStreamerRef.current.getStatus();
        setAudioAnalytics(status.analytics);
        
        // Update waveform data
        const newAudioData = audioStreamerRef.current.getAudioDataChunks();
        setAudioDataChunks(newAudioData);
      }
    }, 500);
    
    return () => {
      audioStreamerRef.current?.stop();
      clearInterval(analyticsInterval);
    };
  }, [addDebugMessage]);
  
  // Get access token from our API
  const fetchAccessToken = async (): Promise<string> => {
    addDebugMessage('Requesting access token...');
    const response = await fetch('/api/hume-token', { method: 'POST' });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get token');
    }
    
    addDebugMessage(`Token received, expires in ${data.expiresIn}s`);
    return data.accessToken;
  };
  
  // Connect to Hume AI WebSocket
  const connect = async () => {
    if (isConnected) return;
    
    try {
      setConnectionStatus('Connecting...');
      addDebugMessage('Starting connection to Hume AI...');
      
      const token = await fetchAccessToken();
      const wsUrl = `wss://api.hume.ai/v0/evi/chat?access_token=${token}`;
      
      addDebugMessage('Opening WebSocket connection...');
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Connected');
        addDebugMessage('✅ Connected to Hume AI successfully');
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleHumeMessage(data);
        } catch (error) {
          addDebugMessage(`❌ Failed to parse message: ${error}`);
        }
      };
      
      socket.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        setIsGenerating(false);
        addDebugMessage(`🔌 WebSocket closed (code: ${event.code})`);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
        addDebugMessage('❌ WebSocket connection error');
      };
      
      wsRef.current = socket;
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('Failed');
      addDebugMessage(`❌ Connection failed: ${error}`);
    }
  };
  
  // Handle messages from Hume AI
  const handleHumeMessage = (data: any) => {
    addDebugMessage(`📨 Received: ${data.type}`);
    
    switch (data.type) {
      case 'audio_output':
        if (data.data) {
          addDebugMessage('🎵 Audio chunk received');
          audioStreamerRef.current?.enqueue(data.data);
        }
        break;
        
      case 'assistant_message':
        if (data.message?.content) {
          addDebugMessage(`🤖 Assistant: "${data.message.content}"`);
        }
        break;
        
      case 'assistant_end':
        setIsGenerating(false);
        setConnectionStatus('Connected');
        addDebugMessage('✅ TTS generation complete');
        break;
        
      case 'error':
        setIsGenerating(false);
        addDebugMessage(`❌ Hume AI error: ${data.message || 'Unknown error'}`);
        break;
        
      case 'user_interruption':
        setIsGenerating(false);
        addDebugMessage('⏸️ Generation interrupted');
        break;
        
      default:
        addDebugMessage(`📋 Other message: ${data.type}`);
    }
  };
  
  // Disconnect from WebSocket
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = undefined;
    }
    audioStreamerRef.current?.stop();
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    setIsGenerating(false);
    addDebugMessage('🔌 Disconnected from Hume AI');
  };
  
  // Generate speech from text
  const generateSpeech = async () => {
    if (!isConnected || !text.trim() || !wsRef.current || isGenerating) {
      return;
    }
    
    // Reset analytics for new session
    audioStreamerRef.current?.resetSession();
    setAudioDataChunks([]); // Clear waveform data
    addDebugMessage('📊 Analytics reset for new TTS generation');
    
    setIsGenerating(true);
    setConnectionStatus('Generating...');
    addDebugMessage(`🎤 Generating speech for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    try {
      // Send assistant input to Hume AI with strip_headers for clean streaming
      const message = {
        type: 'assistant_input',
        text: text.trim(),
        // Critical: strip_headers prevents audio pops by removing WAV headers from each chunk
        strip_headers: true
      };
      
      wsRef.current.send(JSON.stringify(message));
      addDebugMessage('📤 Text sent to Hume AI for TTS generation');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsGenerating(false);
      setConnectionStatus('Connected');
      addDebugMessage(`❌ Failed to send message: ${error}`);
    }
  };
  
  // Stop audio playback
  const stopAudio = () => {
    audioStreamerRef.current?.stop();
    addDebugMessage('⏹️ Audio playback stopped');
  };
  
  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    audioStreamerRef.current?.setVolume(newVolume);
  };
  
  // Clear debug log
  const clearDebugLog = () => {
    setDebugLog([]);
  };
  
  // Copy debug logs to clipboard
  const copyLogsToClipboard = async () => {
    try {
      const logsText = debugLog.join('\n');
      await navigator.clipboard.writeText(logsText);
      addDebugMessage('📋 Logs copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy logs:', error);
      addDebugMessage('❌ Failed to copy logs to clipboard');
    }
  };
  
  const playerStatus = audioStreamerRef.current?.getStatus() || {
    isPlaying: false,
    queueSize: 0,
    analytics: {
      totalChunksReceived: 0,
      totalChunksPlayed: 0,
      bufferUnderruns: 0,
      bufferOverflows: 0,
      averageChunkDuration: 0,
      minQueueSize: 0,
      maxQueueSize: 0,
      totalPlaybackTime: 0,
      bufferStarvationTime: 0,
      consecutiveUnderruns: 0,
      isBuffering: false
    },
    bufferHealth: {
      isHealthy: true,
      healthScore: 100,
      issues: []
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Mic className="w-10 h-10" />
            Hume AI TTS Streaming Playground
          </h1>
          <p className="text-gray-600">
            Perfect gapless audio streaming using Web Audio API
          </p>
        </div>
        
        {/* Connection Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Plug className="w-5 h-5" />
            Hume AI Connection
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={isConnected ? disconnect : connect}
              disabled={connectionStatus === 'Connecting...'}
              className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                isConnected 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : connectionStatus === 'Connecting...'
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {connectionStatus === 'Connecting...' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Disconnect
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect to Hume AI
                </>
              )}
            </button>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 
                connectionStatus === 'Connecting...' ? 'bg-yellow-500' :
                connectionStatus === 'Failed' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
              <span className="text-sm font-medium">{connectionStatus}</span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <p className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Authentication: Server-side token generation (secure)
            </p>
            <p className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Endpoint: wss://api.hume.ai/v0/evi/chat
            </p>
          </div>
        </div>
        
        {/* TTS Input Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Text-to-Speech
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Text to Convert to Speech:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech... (e.g., 'Hello, this is a test of Hume AI text-to-speech!')"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {text.length}/1000 characters
            </div>
          </div>
          
          <div className="flex gap-3 mb-4">
            <button
              onClick={generateSpeech}
              disabled={!isConnected || !text.trim() || isGenerating}
              className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                !isConnected || !text.trim() || isGenerating
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Generate Speech
                </>
              )}
            </button>
            
            <button
              onClick={stopAudio}
              disabled={!isPlayingAudio && playerStatus.queueSize === 0}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-md font-medium transition-colors flex items-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Stop Audio
            </button>
            
            {/* Quick Test Examples Dropdown */}
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setText(e.target.value);
                    e.target.value = ''; // Reset dropdown
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors appearance-none cursor-pointer flex items-center gap-2"
                defaultValue=""
              >
                <option value="" hidden>
                  ⚡ Quick Examples
                </option>
                <option value="Hello! Welcome to the Hume AI text-to-speech playground.">
                  Simple Greeting
                </option>
                <option value="This is a demonstration of Hume AI's Octave text-to-speech system streaming directly to your browser.">
                  Technical Demo
                </option>
                <option value="The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the alphabet and is perfect for testing speech synthesis quality.">
                  Longer Text
                </option>
                <option value="Wow, this is amazing! I can't believe how natural and clear this voice sounds. The technology is truly impressive.">
                  Expressive Text
                </option>
              </select>
            </div>
          </div>
          
          {/* Audio Controls */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio Controls
            </h3>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-medium">Volume:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono w-12">{Math.round(volume * 100)}%</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                {isPlayingAudio ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <Play className="w-3 h-3" /> Playing
                  </span>
                ) : (
                  <span className="text-gray-600 flex items-center gap-1">
                    <StopCircle className="w-3 h-3" /> Stopped
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium">Queue:</span>{' '}
                <span className="text-blue-600">{playerStatus.queueSize} chunks</span>
              </div>
              <div>
                <span className="font-medium">Chunks:</span>{' '}
                <span className="text-purple-600">
                  {audioAnalytics?.totalChunksReceived || 0} received
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Web Audio API Stats */}
        {playerStatus.webAudioStats && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Web Audio API Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <div className="font-semibold text-blue-800 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Context State
                </div>
                <div className={`text-lg ${
                  playerStatus.webAudioStats.audioContextState === 'running' 
                    ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {playerStatus.webAudioStats.audioContextState}
                </div>
              </div>
              
              <div className="bg-purple-50 p-3 rounded">
                <div className="font-semibold text-purple-800 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Buffer Time
                </div>
                <div className="text-lg text-purple-600">
                  {playerStatus.webAudioStats.bufferedTime}
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded">
                <div className="font-semibold text-green-800 flex items-center gap-2">
                  <WaveformIcon className="w-4 h-4" />
                  Active Sources
                </div>
                <div className="text-lg text-green-600">
                  {playerStatus.webAudioStats.scheduledSources}
                </div>
              </div>
              
              <div className="bg-orange-50 p-3 rounded">
                <div className="font-semibold text-orange-800 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Current Time
                </div>
                <div className="text-lg text-orange-600">
                  {playerStatus.webAudioStats.currentTime}s
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Waveform Analysis */}
        <AudioWaveform 
          audioChunks={audioDataChunks}
          className="mb-6"
        />
        
        {/* Debug Console */}
        <div className="bg-gray-900 text-green-400 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Debug Console
            </h2>
            <div className="flex gap-2">
              <button
                onClick={copyLogsToClipboard}
                disabled={debugLog.length === 0}
                className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-green-400 rounded text-sm transition-colors flex items-center gap-2"
              >
                <Copy className="w-3 h-3" />
                Copy Logs
              </button>
              <button
                onClick={clearDebugLog}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-sm transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Clear Log
              </button>
            </div>
          </div>
          <div className="font-mono text-sm h-64 overflow-y-auto">
            {debugLog.length === 0 ? (
              <div className="text-gray-500">Debug messages will appear here...</div>
            ) : (
              debugLog.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}