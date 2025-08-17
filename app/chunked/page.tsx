'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';
import { AudioWaveform } from '@/components/AudioWaveform';
import { DebugConsole } from '@/components/DebugConsole';
import { ChunkTimingVisualization, ChunkEvent } from '@/components/ChunkTimingVisualization';
import { PlaygroundLayout } from '@/components/PlaygroundLayout';
import { chunkExamples, getExampleById, ChunkExample } from '@/lib/chunkExamples';
import { StreamingAudioBuffer } from '@/lib/StreamingAudioBuffer';
import { Play, Square, Volume2 } from 'lucide-react';

export default function ChunkedTTSPage() {
  // Example selection
  const [selectedExampleId, setSelectedExampleId] = useState(chunkExamples[0].id);
  const [currentExample, setCurrentExample] = useState<ChunkExample | null>(chunkExamples[0]);
  
  // Chunking state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [voiceId, setVoiceId] = useState('');
  
  // Audio state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(1.0);
  
  // Debug and timing state
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [timingEvents, setTimingEvents] = useState<ChunkEvent[]>([]);
  
  // Buffer status state
  const [bufferStatus, setBufferStatus] = useState<{
    queuedChunks: number;
    nextExpected: number;
  } | null>(null);
  
  // Waveform state
  const [audioDataChunks, setAudioDataChunks] = useState<ArrayBuffer[]>([]);
  
  // Refs
  const audioStreamerRef = useRef<WebAudioStreamer | null>(null);
  const chunkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const streamingBufferRef = useRef<StreamingAudioBuffer | null>(null);
  
  // Add debug message
  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
  }, []);
  
  // Add timing event
  const addTimingEvent = useCallback((event: Omit<ChunkEvent, 'id'>) => {
    const fullEvent: ChunkEvent = {
      ...event,
      id: `${event.type}_${Date.now()}_${Math.random()}`
    };
    setTimingEvents(prev => [...prev, fullEvent]);
  }, []);
  
  // Initialize Web Audio streamer and streaming buffer
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioStreamerRef.current = new WebAudioStreamer(
        setIsPlayingAudio,
        addDebugMessage
      );
    }
    
    if (!streamingBufferRef.current) {
      streamingBufferRef.current = new StreamingAudioBuffer();
      
      // Set up buffer callbacks
      streamingBufferRef.current.onAudioReady((audioData: string, chunkIndex: number) => {
        addDebugMessage(`🎵 BUFFER: Playing chunk ${chunkIndex} in correct order`);
        
        // Record timing event for buffered audio
        addTimingEvent({
          type: 'audio_received',
          timestamp: Date.now(),
          chunkIndex,
          audioLength: audioData.length
        });
        
        // Send to audio streamer
        if (audioStreamerRef.current) {
          audioStreamerRef.current.enqueue(audioData);
          
          // Convert to ArrayBuffer for waveform
          const audioChunk = Uint8Array.from(atob(audioData), c => c.charCodeAt(0)).buffer;
          setAudioDataChunks(prev => [...prev, audioChunk]);
        }
      });
      
      streamingBufferRef.current.onBufferStatus((queuedChunks: number, nextExpected: number) => {
        setBufferStatus({ queuedChunks, nextExpected });
        if (queuedChunks > 0) {
          addDebugMessage(`📊 BUFFER: ${queuedChunks} chunks waiting, expecting #${nextExpected}`);
        }
      });
    }
    
    // Update waveform data periodically
    const analyticsInterval = setInterval(() => {
      if (audioStreamerRef.current) {
        const newAudioData = audioStreamerRef.current.getAudioDataChunks();
        setAudioDataChunks(newAudioData);
      }
    }, 500);
    
    return () => {
      audioStreamerRef.current?.stop();
      clearInterval(analyticsInterval);
      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current);
      }
    };
  }, [addDebugMessage, addTimingEvent]);
  
  // Handle example selection
  const handleExampleChange = (exampleId: string) => {
    setSelectedExampleId(exampleId);
    const example = getExampleById(exampleId);
    setCurrentExample(example || null);
    setCurrentChunkIndex(0);
    
    // Stop any ongoing generation
    if (isGenerating) {
      stopGeneration();
    }
  };
  
  // Send individual chunk to TTS API (unbuffered approach)
  const sendChunkToTTS = useCallback(async (chunkText: string, chunkIndex: number): Promise<void> => {
    addDebugMessage(`🚀 Sending chunk ${chunkIndex + 1}: "${chunkText.substring(0, 50)}..."`);
    
    // Record timing event for chunk sent
    addTimingEvent({
      type: 'chunk_sent',
      timestamp: Date.now(),
      chunkIndex,
      chunkText
    });
    
    try {
      const payload = {
        text: chunkText.trim(),
        ...(voiceId?.trim() && { voice: voiceId.trim() })
      };
      
      addDebugMessage(`📋 Payload for chunk ${chunkIndex + 1}: ${JSON.stringify(payload)}`);
      
      const response = await fetch('/api/tts-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      addDebugMessage(`📡 Got response for chunk ${chunkIndex + 1}: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`TTS API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }
      
      addDebugMessage(`📤 Chunk ${chunkIndex + 1} sent to TTS API, processing stream...`);
      
      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.audio && audioStreamerRef.current) {
              addDebugMessage(`🔊 Received audio for chunk ${chunkIndex + 1} (${data.audio.length} chars)`);
              
              // Record timing event for audio received
              addTimingEvent({
                type: 'audio_received',
                timestamp: Date.now(),
                chunkIndex,
                audioLength: data.audio.length
              });
              
              audioStreamerRef.current.enqueue(data.audio);
              
              // Convert to ArrayBuffer for waveform
              const audioChunk = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0)).buffer;
              setAudioDataChunks(prev => [...prev, audioChunk]);
            }
            
            if (data.is_last_chunk || data.metadata?.is_last_chunk) {
              addDebugMessage(`✅ Chunk ${chunkIndex + 1} complete`);
              break;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
      
    } catch (error) {
      console.error(`Chunk ${chunkIndex + 1} failed:`, error);
      addDebugMessage(`❌ Chunk ${chunkIndex + 1} error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, [addDebugMessage, addTimingEvent, voiceId]);
  
  // Start chunked generation (unbuffered approach)
  const startChunkedGeneration = useCallback(async () => {
    if (!currentExample || isGenerating) {
      addDebugMessage(`❌ Cannot start: currentExample=${!!currentExample}, isGenerating=${isGenerating}`);
      return;
    }
    
    addDebugMessage(`🔧 Setting isGenerating to true...`);
    setIsGenerating(true);
    setCurrentChunkIndex(0);
    setTimingEvents([]);
    
    // Reset audio
    audioStreamerRef.current?.resetSession();
    setAudioDataChunks([]);
    
    addDebugMessage(`🎯 Starting chunked TTS for "${currentExample.title}" (${currentExample.chunks.length} chunks)`);
    
    // Use a ref to track if we should continue (since state updates are async)
    let shouldContinue = true;
    
    try {
      // Send chunks sequentially with realistic delays (simulating LLM output)
      for (let i = 0; i < currentExample.chunks.length; i++) {
        if (!shouldContinue) {
          addDebugMessage(`🛑 Generation stopped at chunk ${i + 1}`);
          break;
        }
        
        setCurrentChunkIndex(i);
        addDebugMessage(`📍 Processing chunk ${i + 1} of ${currentExample.chunks.length}`);
        
        try {
          // Send this chunk immediately (unbuffered approach)
          await sendChunkToTTS(currentExample.chunks[i], i);
          addDebugMessage(`✅ Chunk ${i + 1} processing complete`);
        } catch (chunkError) {
          addDebugMessage(`❌ Chunk ${i + 1} failed: ${chunkError instanceof Error ? chunkError.message : String(chunkError)}`);
          // Continue with next chunk even if one fails
        }
        
        // Simulate delay between LLM chunk generations (0.5-2 seconds)
        if (i < currentExample.chunks.length - 1 && shouldContinue) {
          const delay = 500 + Math.random() * 1500;
          addDebugMessage(`⏳ Waiting ${delay.toFixed(0)}ms before next chunk...`);
          
          await new Promise<void>((resolve, reject) => {
            chunkTimeoutRef.current = setTimeout(() => {
              if (shouldContinue) {
                addDebugMessage(`⏰ Delay complete, continuing to next chunk...`);
                resolve();
              } else {
                reject(new Error('Generation stopped'));
              }
            }, delay);
          });
        }
      }
      
      if (shouldContinue) {
        addDebugMessage(`🏁 All ${currentExample.chunks.length} chunks sent successfully!`);
      }
      
    } catch (error) {
      addDebugMessage(`❌ Chunked generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      shouldContinue = false;
      setIsGenerating(false);
      setCurrentChunkIndex(0);
    }
  }, [currentExample, isGenerating, addDebugMessage, addTimingEvent, voiceId, sendChunkToTTS]);
  
  // Start concurrent generation (demonstrates the actual problem)
  const startConcurrentGeneration = useCallback(async () => {
    if (!currentExample || isGenerating) {
      addDebugMessage(`❌ Cannot start: currentExample=${!!currentExample}, isGenerating=${isGenerating}`);
      return;
    }
    
    addDebugMessage(`🔧 Setting isGenerating to true...`);
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setCurrentChunkIndex(0);
    setTimingEvents([]);
    
    // Reset audio
    audioStreamerRef.current?.resetSession();
    setAudioDataChunks([]);
    
    addDebugMessage(`💥 Starting CONCURRENT chunked TTS for "${currentExample.title}" (${currentExample.chunks.length} chunks)`);
    addDebugMessage(`⚠️  This simulates the problematic behavior where chunks are sent as they arrive!`);
    
    try {
      // Create promises for all chunks with realistic arrival delays
      const chunkPromises = currentExample.chunks.map(async (chunkText, index) => {
        // Simulate LLM generating chunks at different times
        const arrivalDelay = index * (200 + Math.random() * 800); // 200-1000ms between chunk arrivals
        
        await new Promise(resolve => setTimeout(resolve, arrivalDelay));
        
        if (!isGeneratingRef.current) {
          addDebugMessage(`🛑 Chunk ${index + 1} cancelled (generation stopped)`);
          return;
        }
        
        addDebugMessage(`📨 LLM chunk ${index + 1} arrived, sending to TTS immediately!`);
        setCurrentChunkIndex(index);
        
        try {
          await sendChunkToTTS(chunkText, index);
          addDebugMessage(`✅ Chunk ${index + 1} TTS request completed`);
        } catch (error) {
          addDebugMessage(`❌ Chunk ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      // Wait for all chunks to be processed
      await Promise.all(chunkPromises);
      
      addDebugMessage(`🏁 All ${currentExample.chunks.length} concurrent chunks sent!`);
      addDebugMessage(`🎵 Notice how audio chunks arrive out of order in the timing visualization!`);
      
    } catch (error) {
      addDebugMessage(`❌ Concurrent generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setCurrentChunkIndex(0);
    }
  }, [currentExample, isGenerating, addDebugMessage, addTimingEvent, voiceId, sendChunkToTTS]);
  
  // Send chunk to TTS but route through streaming buffer (for buffered mode)
  const sendChunkToTTSBuffered = useCallback(async (chunkText: string, chunkIndex: number): Promise<void> => {
    addDebugMessage(`🚀 BUFFERED: Sending chunk ${chunkIndex + 1} (index ${chunkIndex}): "${chunkText.substring(0, 50)}..."`);
    addDebugMessage(`🔍 BUFFERED: This chunk will go through the streaming buffer system`);
    
    // Record timing event for chunk sent
    addTimingEvent({
      type: 'chunk_sent',
      timestamp: Date.now(),
      chunkIndex,
      chunkText
    });
    
    try {
      const payload = {
        text: chunkText.trim(),
        ...(voiceId?.trim() && { voice: voiceId.trim() })
      };
      
      addDebugMessage(`📋 BUFFERED: Payload for chunk ${chunkIndex + 1}: ${JSON.stringify(payload)}`);
      
      const response = await fetch('/api/tts-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      addDebugMessage(`📡 BUFFERED: Got response for chunk ${chunkIndex + 1}: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`TTS API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }
      
      addDebugMessage(`📤 BUFFERED: Chunk ${chunkIndex + 1} sent to TTS API, processing stream...`);
      
      // Process streaming response - but route through buffer
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.audio && streamingBufferRef.current) {
              const isLastChunk = data.is_last_chunk || data.metadata?.is_last_chunk;
              addDebugMessage(`🔊 BUFFERED: Received audio for chunk ${chunkIndex + 1}, adding to buffer (last: ${isLastChunk})`);
              
              // Route through streaming buffer instead of direct enqueue
              streamingBufferRef.current.addAudioChunk(data.audio, chunkIndex, isLastChunk);
            }
            
            if (data.is_last_chunk || data.metadata?.is_last_chunk) {
              addDebugMessage(`✅ BUFFERED: Chunk ${chunkIndex + 1} complete`);
              break;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
      
    } catch (error) {
      console.error(`Buffered chunk ${chunkIndex + 1} failed:`, error);
      addDebugMessage(`❌ BUFFERED: Chunk ${chunkIndex + 1} error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, [addDebugMessage, addTimingEvent, voiceId]);
  
  // Start buffered generation (demonstrates the CORRECT solution)
  const startBufferedGeneration = useCallback(async () => {
    if (!currentExample || isGenerating) {
      addDebugMessage(`❌ Cannot start: currentExample=${!!currentExample}, isGenerating=${isGenerating}`);
      return;
    }
    
    addDebugMessage(`🔧 Setting isGenerating to true...`);
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setCurrentChunkIndex(0);
    setTimingEvents([]);
    
    // Reset audio and buffer
    audioStreamerRef.current?.resetSession();
    streamingBufferRef.current?.reset();
    setAudioDataChunks([]);
    setBufferStatus(null);
    
    addDebugMessage(`🎯 Starting BUFFERED chunked TTS for "${currentExample.title}" (${currentExample.chunks.length} chunks)`);
    addDebugMessage(`✨ This demonstrates the CORRECT solution: SEQUENTIAL TTS requests with continuous buffering!`);
    addDebugMessage(`📋 Key insight: We queue text chunks but process TTS sequentially, one at a time`);
    
    // Array to hold text chunks in their correct sequence order
    const textChunks: Array<{text: string, index: number} | null> = new Array(currentExample.chunks.length).fill(null);
    let activeTTSRequest = false;
    let nextTTSIndex = 0; // Next chunk index we should process for TTS
    
    // Function to process next TTS request in sequence
    const processNextTTS = async () => {
      if (activeTTSRequest || !isGeneratingRef.current) {
        return;
      }
      
      // Check if the next chunk in sequence is available
      if (nextTTSIndex >= textChunks.length || !textChunks[nextTTSIndex]) {
        return; // Next chunk not available yet
      }
      
      activeTTSRequest = true;
      const nextChunk = textChunks[nextTTSIndex]!;
      
      addDebugMessage(`🎤 BUFFERED: Starting TTS for chunk ${nextChunk.index + 1} (sequential processing)`);
      setCurrentChunkIndex(nextChunk.index);
      
      try {
        await sendChunkToTTS(nextChunk.text, nextChunk.index);
        addDebugMessage(`✅ BUFFERED: TTS completed for chunk ${nextChunk.index + 1}`);
      } catch (error) {
        addDebugMessage(`❌ BUFFERED: TTS failed for chunk ${nextChunk.index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        activeTTSRequest = false;
        nextTTSIndex++;
        
        // Immediately try to process the next chunk in sequence
        setTimeout(() => processNextTTS(), 100);
      }
    };
    
    try {
      // Simulate LLM chunks arriving at different times (but queue them for sequential TTS)
      const chunkPromises = currentExample.chunks.map(async (chunkText, index) => {
        // Simulate LLM generating chunks at different times
        const arrivalDelay = index * (200 + Math.random() * 800);
        
        await new Promise(resolve => setTimeout(resolve, arrivalDelay));
        
        if (!isGeneratingRef.current) {
          addDebugMessage(`🛑 BUFFERED: Chunk ${index + 1} cancelled (generation stopped)`);
          return;
        }
        
        addDebugMessage(`📨 BUFFERED: LLM chunk ${index + 1} arrived, storing in sequence position ${index}`);
        
        // Store chunk in its correct sequence position
        textChunks[index] = { text: chunkText, index };
        
        // Try to process TTS if this enables the next sequential chunk
        processNextTTS();
      });
      
      // Wait for all LLM chunks to arrive
      await Promise.all(chunkPromises);
      
      // Wait for all TTS requests to be processed sequentially
      while ((nextTTSIndex < textChunks.length || activeTTSRequest) && isGeneratingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      addDebugMessage(`🏁 BUFFERED: All ${currentExample.chunks.length} chunks processed sequentially!`);
      addDebugMessage(`🎵 Notice: Perfect audio order because TTS was processed one-at-a-time!`);
      
    } catch (error) {
      addDebugMessage(`❌ BUFFERED: Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setCurrentChunkIndex(0);
    }
  }, [currentExample, isGenerating, addDebugMessage, addTimingEvent, voiceId, sendChunkToTTS]);
  
  // Stop generation
  const stopGeneration = () => {
    setIsGenerating(false);
    isGeneratingRef.current = false;
    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current);
      chunkTimeoutRef.current = null;
    }
    // Reset streaming buffer as well
    streamingBufferRef.current?.reset();
    setBufferStatus(null);
    addDebugMessage('🛑 Chunked generation stopped');
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

  return (
    <PlaygroundLayout>
      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Chunked TTS Simulation</h2>
        <p className="text-gray-600 mb-4">
          Simulates real LLM output by sending text chunks to TTS in different modes:
        </p>
        <ul className="text-sm text-gray-600 mb-4 space-y-1">
          <li><strong className="text-blue-600">Sequential:</strong> Wait for each TTS to complete before starting next (works but slow)</li>
          <li><strong className="text-red-600">Concurrent:</strong> Start all TTS requests immediately as chunks arrive (fast but wrong order)</li>
          <li><strong className="text-green-600">Buffered:</strong> Queue text chunks, process TTS sequentially with continuous audio buffering (fast AND correct order)</li>
        </ul>
        
        {/* Example Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose Example:
          </label>
          <select
            value={selectedExampleId}
            onChange={(e) => handleExampleChange(e.target.value)}
            disabled={isGenerating}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            {chunkExamples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.title} ({example.chunks.length} chunks) - {example.description}
              </option>
            ))}
          </select>
        </div>
        
        {/* Voice ID */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice ID (optional):
          </label>
          <input
            type="text"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={isGenerating}
            placeholder="e.g., custom-voice-id"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
        </div>
        
        {/* Controls */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={startChunkedGeneration}
            disabled={isGenerating || !currentExample}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Sequential (No Issues)
          </button>
          
          <button
            onClick={startConcurrentGeneration}
            disabled={isGenerating || !currentExample}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Concurrent (Problematic)
          </button>
          
          <button
            onClick={startBufferedGeneration}
            disabled={isGenerating || !currentExample}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Concurrent (Buffered)
          </button>
          
          <button
            onClick={stopGeneration}
            disabled={!isGenerating}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
          
          <button
            onClick={stopAudio}
            disabled={!isPlayingAudio}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            Stop Audio
          </button>
        </div>
        
        {/* Volume Control */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 w-12">{Math.round(volume * 100)}%</span>
        </div>
        
        {/* Status */}
        {isGenerating && currentExample && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="font-medium text-blue-800">
              Generating chunk {currentChunkIndex + 1} of {currentExample.chunks.length}
            </div>
            <div className="text-sm text-blue-600 mt-1">
              "{currentExample.chunks[currentChunkIndex]?.substring(0, 80)}..."
            </div>
          </div>
        )}
        
        {/* Buffer Status Indicator */}
        {bufferStatus && bufferStatus.queuedChunks > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="font-medium text-green-800 flex items-center gap-2">
              🎯 Streaming Buffer Active
            </div>
            <div className="text-sm text-green-600 mt-1">
              {bufferStatus.queuedChunks} chunks waiting for playback, expecting chunk #{bufferStatus.nextExpected}
            </div>
            <div className="text-xs text-green-500 mt-1">
              Buffer ensures audio plays in correct sequence order
            </div>
          </div>
        )}
      </div>
      
      {/* Preview of chunks */}
      {currentExample && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3">Chunk Preview: {currentExample.title}</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {currentExample.chunks.map((chunk, index) => (
              <div
                key={index}
                className={`p-2 rounded border ${
                  isGenerating && index === currentChunkIndex
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-600">Chunk {index + 1}:</span>
                <span className="ml-2 text-sm">{chunk}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Timing Visualization */}
      <ChunkTimingVisualization
        events={timingEvents}
        className="mb-6"
      />
      
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