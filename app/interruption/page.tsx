'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';
import { AudioWaveform } from '@/components/AudioWaveform';
import { DebugConsole } from '@/components/DebugConsole';
import { WebAudioStats } from '@/components/WebAudioStats';
import { PlaygroundLayout } from '@/components/PlaygroundLayout';
import { InterruptionInputPanel } from '@/components/InterruptionInputPanel';
import { AudioChunkInfoPanel } from '@/components/AudioChunkInfoPanel';
import { InterruptionTimingVisualization, InterruptionEvent } from '@/components/InterruptionTimingVisualization';
import { splitTextIntoChunks, TextChunk } from '@/lib/textChunker';
import { ChunkValidator } from '@/lib/chunkValidator';

export default function InterruptionPage() {
  // TTS state
  const [text, setText] = useState('This is a longer piece of text that will be used to test interruption handling. When you interrupt during playback, we can analyze how the system responds and recovers.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceId, setVoiceId] = useState('b0acad48-4c2a-462f-8908-485f4d1d2418');
  
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
  
  // Chunk metadata state
  const [chunkInfos, setChunkInfos] = useState<any[]>([]);
  
  // Interruption timing events
  const [interruptionEvents, setInterruptionEvents] = useState<InterruptionEvent[]>([]);
  
  // Chunked streaming state
  const [textChunks, setTextChunks] = useState<TextChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  
  // Refs
  const audioStreamerRef = useRef<WebAudioStreamer | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const chunkValidatorRef = useRef<ChunkValidator>(new ChunkValidator());
  
  // Add debug message (define this first) - oldest first
  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
  }, []);

  // Add interruption event for timing analysis
  const addInterruptionEvent = useCallback((
    type: InterruptionEvent['type'],
    parentChunk?: number,
    chunkIndex?: number,
    textPreview?: string,
    expectedText?: string,
    validationReason?: string,
    audioSize?: number
  ) => {
    const event: InterruptionEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      timestamp: Date.now(),
      parentChunk,
      chunkIndex,
      textPreview,
      expectedText,
      validationReason,
      audioSize
    };
    
    setInterruptionEvents(prev => [...prev, event].slice(-100)); // Keep last 100 events
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
  
  // Send a single text to TTS (for interruption responses)
  const sendSingleTextToTTS = async (text: string): Promise<void> => {
    const payload = {
      text: text.trim(),
      voice: voiceId,
      context: continuationEnabled && lastGenerationId ? { generation_id: lastGenerationId } : undefined
    };

    addDebugMessage(`🚀 Sending system response TTS: "${text}"`);

    const response = await fetch('/api/tts-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
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
            
            // Store chunk info for debugging
            const chunkInfo = {
              chunkNumber: chunkInfos.length + 1,
              timestamp: new Date().toISOString(),
              rawData: {
                ...data,
                audio: data.audio ? `[${data.audio.length} chars base64 audio data]` : undefined
              },
              audioDataLength: data.audio?.length || 0,
              processingTime: Date.now(),
              receivedAt: Date.now(),
              parentChunkIndex: -1 // Special marker for system response to user interruption
            };
            
            setChunkInfos(prev => [...prev, chunkInfo]);
            
            if (data.audio && audioStreamerRef.current) {
              // Validate the chunk using text batch matching
              const validation = chunkValidatorRef.current.validateChunk(data.text || '');
              
              const isValidChunk = validation.isValid;
              const validationReason = validation.reason || 'Unknown validation result';
              
              // Update chunk info with validation result
              chunkInfo.validation = {
                isValid: isValidChunk,
                reason: validationReason,
                chunkText: data.text || null,
                expectedText: chunkValidatorRef.current.getExpectedText()
              };
              
              if (validation.isValid) {
                addDebugMessage(`✅ Playing system response: "${(data.text || '').substring(0, 30)}..." (${data.audio.length} chars audio)`);
                audioStreamerRef.current.enqueue(data.audio, true);
                setIsPlayingAudio(true);
                
                // Log system response chunk event
                addInterruptionEvent('system_response', -1, data.chunk_index, data.text, chunkValidatorRef.current.getExpectedText(), undefined, data.audio?.length);
              } else {
                addDebugMessage(`🗑️ DISCARDED system response chunk: "${(data.text || '').substring(0, 30)}..." - ${validationReason}`);
                
                // Log discarded system response chunk
                addInterruptionEvent('chunk_discarded', -1, data.chunk_index, data.text, chunkValidatorRef.current.getExpectedText(), validationReason, data.audio?.length);
              }
            }

            // Update continuation ID if present
            if (data.generation_id) {
              setLastGenerationId(data.generation_id);
            }

            if (data.is_last_chunk || data.metadata?.is_last_chunk) {
              addDebugMessage(`✅ System response TTS stream complete`);
              break;
            }

          } catch (parseError) {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Send individual chunk to TTS API
  const sendChunkToTTS = useCallback(async (chunkText: string, chunkIndex: number): Promise<void> => {
    addDebugMessage(`🚀 Sending chunk ${chunkIndex + 1}: "${chunkText.substring(0, 50)}..."`);
    
    try {
      const payload = {
        text: chunkText.trim(),
        ...(voiceId?.trim() && { voice: voiceId.trim() })
      };
      
      const response = await fetch('/api/tts-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
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
      let chunkCounter = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkReceivedAt = performance.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const data = JSON.parse(line);
            chunkCounter++;
            
            // Create chunk info object
            const chunkInfo = {
              chunkNumber: chunkCounter,
              timestamp: new Date().toISOString(),
              rawData: {
                ...data,
                audio: data.audio ? `[${data.audio.length} chars base64 audio data]` : undefined
              },
              audioDataLength: data.audio?.length || 0,
              processingTime: chunkReceivedAt,
              receivedAt: chunkReceivedAt,
              parentChunkIndex: chunkIndex
            };
            
            setChunkInfos(prev => [...prev, chunkInfo]);
            
            if (data.audio && audioStreamerRef.current) {
              // Validate the chunk using text batch matching
              const validation = chunkValidatorRef.current.validateChunk(data.text || '');
              
              const isValidChunk = validation.isValid;
              const validationReason = validation.reason || 'Unknown validation result';
              
              if (validation.isValid) {
                addDebugMessage(`✅ Validated chunk: "${(data.text || '').substring(0, 30)}..." (${data.audio.length} chars audio)`);
              } else {
                addDebugMessage(`🗑️ DISCARDED chunk: "${(data.text || '').substring(0, 30)}..." - ${validationReason}`);
              }
              
              // Update chunk info with validation result
              chunkInfo.validation = {
                isValid: isValidChunk,
                reason: validationReason,
                chunkText: data.text || null,
                expectedText: chunkValidatorRef.current.getExpectedText()
              };
              
              if (isValidChunk) {
                addDebugMessage(`🔊 Playing validated audio for chunk ${chunkIndex + 1} (${data.audio.length} chars)`);
                audioStreamerRef.current.enqueue(data.audio, true); // PCM format from Hume AI
                
                // Convert to ArrayBuffer for waveform
                const audioChunk = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0)).buffer;
                setAudioDataChunks(prev => [...prev, audioChunk]);
                
                // Log valid chunk event
                addInterruptionEvent('chunk_valid', chunkIndex, data.chunk_index, data.text, chunkValidatorRef.current.getExpectedText(), undefined, data.audio?.length);
              } else {
                addDebugMessage(`🚫 Skipped audio playback for invalid chunk ${chunkIndex + 1}`);
                
                // Log discarded chunk event
                addInterruptionEvent('chunk_discarded', chunkIndex, data.chunk_index, data.text, chunkValidatorRef.current.getExpectedText(), validationReason, data.audio?.length);
              }
            }
            
            if (data.is_last_chunk || data.metadata?.is_last_chunk) {
              addDebugMessage(`✅ Chunk ${chunkIndex + 1} complete`);
              break;
            }
          } catch (e) {
            console.error('Error parsing chunk JSON:', e);
          }
        }
      }
      
    } catch (error) {
      console.error(`Chunk ${chunkIndex + 1} failed:`, error);
      addDebugMessage(`❌ Chunk ${chunkIndex + 1} error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, [addDebugMessage, voiceId]);
  
  // Start chunked streaming generation
  const generateSpeech = async () => {
    if (!text.trim() || isGenerating) return;

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setCurrentChunkIndex(-1);
    setChunkInfos([]);
    
    // Reset audio and chunk validator
    audioStreamerRef.current?.resetSession();
    setAudioDataChunks([]);
    chunkValidatorRef.current.reset();
    
    addDebugMessage(`🎯 Starting chunked streaming TTS for text (${text.length} chars)`);
    
    // Split text into chunks
    const chunks = splitTextIntoChunks(text, {
      minChunkSize: 30,
      maxChunkSize: 100,
      preferSentenceBoundaries: true
    });
    
    setTextChunks(chunks);
    addDebugMessage(`📝 Split into ${chunks.length} chunks for streaming`);
    
    try {
      // Send chunks with realistic delays (simulating LLM output)
      for (let i = 0; i < chunks.length; i++) {
        if (!isGeneratingRef.current) {
          addDebugMessage(`🛑 Generation stopped at chunk ${i + 1}`);
          break;
        }
        
        setCurrentChunkIndex(i);
        addDebugMessage(`📍 Processing chunk ${i + 1} of ${chunks.length}`);
        
        try {
          // Set expected text for this text batch
          chunkValidatorRef.current.setExpectedText(chunks[i].text);
          addDebugMessage(`🎯 Set expected text batch ${i + 1}: "${chunks[i].text}"`);
          
          // Log text batch start event
          addInterruptionEvent('text_batch_start', i, undefined, chunks[i].text);
          
          // Send this chunk to TTS
          await sendChunkToTTS(chunks[i].text, i);
          addDebugMessage(`✅ Chunk ${i + 1} processing complete`);
        } catch (chunkError) {
          addDebugMessage(`❌ Chunk ${i + 1} failed: ${chunkError instanceof Error ? chunkError.message : String(chunkError)}`);
          // Continue with next chunk even if one fails
        }
        
        // Simulate delay between LLM chunk generations (0.5-2 seconds)
        if (i < chunks.length - 1 && isGeneratingRef.current) {
          const delay = 500 + Math.random() * 1500;
          addDebugMessage(`⏳ Waiting ${delay.toFixed(0)}ms before next chunk...`);
          
          await new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              if (isGeneratingRef.current) {
                resolve();
              } else {
                reject(new Error('Generation stopped'));
              }
            }, delay);
          });
        }
      }
      
      if (isGeneratingRef.current) {
        addDebugMessage(`🏁 All ${chunks.length} chunks sent successfully!`);
      }
      
    } catch (error) {
      addDebugMessage(`❌ Chunked generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setCurrentChunkIndex(-1);
    }
  };
  
  // Stop generation (interrupting the streaming process)
  const stopGeneration = () => {
    setIsGenerating(false);
    isGeneratingRef.current = false;
    setCurrentChunkIndex(-1);
    chunkValidatorRef.current.reset();
    addDebugMessage('🛑 Chunked generation stopped by user - validator reset (will reject in-flight chunks)');
  };

  // Stop audio playback (simulating user interruption and system response)
  const stopAudio = async () => {
    // CRITICAL: Stop the chunked generation pipeline
    setIsGenerating(false);
    isGeneratingRef.current = false;
    setCurrentChunkIndex(-1);
    
    // Stop current audio and reset validator
    audioStreamerRef.current?.stop();
    chunkValidatorRef.current.reset();
    addDebugMessage('🛑 Audio interrupted by user action - STOPPED chunked generation pipeline and reset validator');
    
    // Log user interruption event
    addInterruptionEvent('user_interrupt');
    
    // Simulate user speech interruption
    addDebugMessage('🎤 [SIMULATED USER SPEECH]: "One moment. Hold on a second."');
    
    // Wait 500ms, then generate system response to the interruption
    addDebugMessage('⏳ Waiting 500ms before generating system response to user interruption...');
    setTimeout(async () => {
      try {
        const systemResponseText = "No problem. I'll wait until you're ready.";
        
        // Set expected text for the system response
        chunkValidatorRef.current.setExpectedText(systemResponseText);
        addDebugMessage(`🎯 Set expected text for system response: "${systemResponseText}"`);
        
        // Generate TTS for system response
        await sendSingleTextToTTS(systemResponseText);
        addDebugMessage('✅ System response TTS completed');
        
      } catch (error) {
        addDebugMessage(`❌ Failed to generate system response: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 500);
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

  // Clear chunk information
  const clearChunks = () => {
    setChunkInfos([]);
    setInterruptionEvents([]);
    addDebugMessage('🗑️ Cleared chunk information and interruption timeline');
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
      {/* Interruption Input Panel */}
      <InterruptionInputPanel
        text={text}
        setText={setText}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        isConnected={true}
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
        chunks={textChunks}
        currentChunkIndex={currentChunkIndex}
        onStopGeneration={stopGeneration}
      />
      
      {/* Audio Chunk Information Panel */}
      <AudioChunkInfoPanel
        chunkInfos={chunkInfos}
        onClearChunks={clearChunks}
      />
      
      {/* Interruption Timing Visualization */}
      <InterruptionTimingVisualization
        events={interruptionEvents}
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