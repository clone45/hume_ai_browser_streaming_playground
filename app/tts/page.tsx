'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';
import { AudioWaveform } from '@/components/AudioWaveform';
import { TextInputPanel } from '@/components/TextInputPanel';
import { DebugConsole } from '@/components/DebugConsole';
import { WebAudioStats } from '@/components/WebAudioStats';
import { PlaygroundLayout } from '@/components/PlaygroundLayout';
import { useTTSStream } from '@/hooks/useTTSStream';

export default function TTSPage() {
  // TTS state
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceId, setVoiceId] = useState('');
  
  // Acting instructions state
  const [description, setDescription] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [trailingSilence, setTrailingSilence] = useState(0);
  
  // Continuation state
  const [continuationEnabled, setContinuationEnabled] = useState(false);
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);
  
  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [audioAnalytics, setAudioAnalytics] = useState<Record<string, unknown> | null>(null);
  
  // Debug state
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Waveform state
  const [audioDataChunks, setAudioDataChunks] = useState<ArrayBuffer[]>([]);
  
  // Refs
  const audioStreamerRef = useRef<WebAudioStreamer | null>(null);
  
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
  
  // Initialize TTS hook
  const { generateTTSSpeech } = useTTSStream({
    audioStreamerRef,
    addDebugMessage,
    setIsGenerating,
    setConnectionStatus: () => {}, // TTS mode doesn't need connection status
    setAudioDataChunks,
    continuationEnabled,
    lastGenerationId,
    setLastGenerationId,
    description,
    speed,
    trailingSilence,
  });
  
  // Generate speech from text (TTS REST)
  const generateSpeech = async () => {
    return generateTTSSpeech(text, voiceId);
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

  // Reset continuation context
  const resetContinuation = () => {
    setLastGenerationId(null);
    addDebugMessage('🔄 Continuation context reset');
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
      {/* TTS Input Panel */}
      <TextInputPanel
        mode="tts"
        text={text}
        setText={setText}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        isConnected={true} // TTS mode doesn't need connection
        isGenerating={isGenerating}
        isPlayingAudio={isPlayingAudio}
        volume={volume}
        audioAnalytics={audioAnalytics}
        playerStatus={playerStatus}
        onGenerateSpeech={generateSpeech}
        onStopAudio={stopAudio}
        onVolumeChange={handleVolumeChange}
        continuationEnabled={continuationEnabled}
        setContinuationEnabled={setContinuationEnabled}
        lastGenerationId={lastGenerationId}
        onResetContinuation={resetContinuation}
        description={description}
        setDescription={setDescription}
        speed={speed}
        setSpeed={setSpeed}
        trailingSilence={trailingSilence}
        setTrailingSilence={setTrailingSilence}
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