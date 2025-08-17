'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';
import { AudioWaveform } from '@/components/AudioWaveform';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { TextInputPanel } from '@/components/TextInputPanel';
import { DebugConsole } from '@/components/DebugConsole';
import { WebAudioStats } from '@/components/WebAudioStats';
import { PlaygroundLayout } from '@/components/PlaygroundLayout';

export default function EVIPage() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  
  // TTS state
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceId, setVoiceId] = useState('');
  
  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [audioAnalytics, setAudioAnalytics] = useState<Record<string, any> | null>(null);
  
  // Debug state
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Waveform state
  const [audioDataChunks, setAudioDataChunks] = useState<ArrayBuffer[]>([]);
  
  // Refs
  const audioStreamerRef = useRef<WebAudioStreamer | null>(null);
  const wsRef = useRef<WebSocket | undefined>(undefined);
  
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
  const handleHumeMessage = (data: Record<string, any>) => {
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
  
  // Generate speech from text (EVI WebSocket)
  const generateSpeech = async () => {
    if (!isConnected || !text.trim() || !wsRef.current || isGenerating) {
      return;
    }
    
    // Reset analytics for new session
    audioStreamerRef.current?.resetSession();
    setAudioDataChunks([]);
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
    },
    webAudioStats: {
      audioContextState: 'suspended',
      currentTime: '0.000',
      nextStartTime: '0.000',
      bufferedTime: '0.0ms',
      scheduledSources: 0
    }
  };

  return (
    <PlaygroundLayout>
      {/* Connection Panel */}
      <ConnectionPanel
        mode="evi"
        isConnected={isConnected}
        connectionStatus={connectionStatus}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      
      {/* TTS Input Panel */}
      <TextInputPanel
        mode="evi"
        text={text}
        setText={setText}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        isConnected={isConnected}
        isGenerating={isGenerating}
        isPlayingAudio={isPlayingAudio}
        volume={volume}
        audioAnalytics={audioAnalytics}
        playerStatus={playerStatus}
        onGenerateSpeech={generateSpeech}
        onStopAudio={stopAudio}
        onVolumeChange={handleVolumeChange}
      />
      
      {/* Web Audio API Stats */}
      {playerStatus.webAudioStats && (
        <WebAudioStats webAudioStats={playerStatus.webAudioStats} />
      )}
      
      {/* Waveform Analysis */}
      <AudioWaveform 
        audioChunks={audioDataChunks}
        className="mb-6"
      />
      
      {/* Debug Console */}
      <DebugConsole
        debugLog={debugLog}
        onCopyLogs={copyLogsToClipboard}
        onClearLog={clearDebugLog}
      />
    </PlaygroundLayout>
  );
}