import { useRef } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';

interface ChunkInfo {
  chunkNumber: number;
  timestamp: string;
  rawData: any; // The full JSON chunk from Hume AI
  audioDataLength?: number;
  processingTime?: number;
  receivedAt: number;
}

interface UseTTSStreamWithChunkInfoProps {
  audioStreamerRef: React.RefObject<WebAudioStreamer | null>;
  addDebugMessage: (message: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setConnectionStatus: (status: string) => void;
  setAudioDataChunks: React.Dispatch<React.SetStateAction<ArrayBuffer[]>>;
  setChunkInfos: React.Dispatch<React.SetStateAction<ChunkInfo[]>>;
  continuationEnabled?: boolean;
  lastGenerationId?: string | null;
  setLastGenerationId?: (id: string | null) => void;
}

export function useTTSStreamWithChunkInfo({
  audioStreamerRef,
  addDebugMessage,
  setIsGenerating,
  setConnectionStatus,
  setAudioDataChunks,
  setChunkInfos,
  continuationEnabled = false,
  lastGenerationId = null,
  setLastGenerationId,
}: UseTTSStreamWithChunkInfoProps) {
  
  const generateTTSSpeech = async (text: string, voiceId: string = '') => {
    if (!text.trim()) return;

    setIsGenerating(true);
    setConnectionStatus('Generating...');
    addDebugMessage(`🎤 Generating TTS for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    // Reset chunk info for new session
    setChunkInfos([]);

    try {
      // Reset analytics for new session
      audioStreamerRef.current?.resetSession();
      setAudioDataChunks([]);

      // Prepare payload
      const payload: any = {
        text: text.trim()
      };

      // Add continuation context if enabled and available
      if (continuationEnabled && lastGenerationId) {
        payload.context = { generation_id: lastGenerationId };
        addDebugMessage(`🔗 Using continuation from generation ${lastGenerationId}`);
      } else if (continuationEnabled) {
        addDebugMessage(`🔗 Continuation enabled, starting fresh (no previous context)`);
      }

      // Add voice config if provided
      if (voiceId?.trim()) {
        payload.voice = voiceId.trim();
        addDebugMessage(`🎤 Using voice ID: ${voiceId.trim()}`);
      }

      // Call TTS API
      const response = await fetch('/api/tts-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('TTS API error response:', errorData);
        throw new Error(`TTS API error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      addDebugMessage('📤 Text sent to Hume AI TTS API');
      
      // Process streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let generationId: string | null = null;
      let chunkCounter = 0;
      const startTime = performance.now();

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
            
            // Create chunk info object with all available data
            const chunkInfo: ChunkInfo = {
              chunkNumber: chunkCounter,
              timestamp: new Date().toISOString(),
              rawData: {
                ...data,
                // Remove the actual audio data to avoid storing large base64 strings
                audio: data.audio ? `[${data.audio.length} chars base64 audio data]` : undefined
              },
              audioDataLength: data.audio?.length || 0,
              processingTime: chunkReceivedAt - startTime,
              receivedAt: chunkReceivedAt
            };

            // Add to chunk infos array
            setChunkInfos(prev => [...prev, chunkInfo]);
            
            // Capture generation ID from response
            if (data.generation_id) {
              generationId = data.generation_id;
              addDebugMessage(`🔗 Received generation ID: ${generationId}`);
            } else if (data.metadata?.generation_id) {
              generationId = data.metadata.generation_id;
              addDebugMessage(`🔗 Received generation ID from metadata: ${generationId}`);
            }
            
            if (data.audio && audioStreamerRef.current) {
              console.log(`🔊 Received PCM audio chunk #${chunkCounter} (${data.audio.length} chars)`);
              audioStreamerRef.current.enqueue(data.audio);
              
              // Convert to ArrayBuffer for waveform
              const audioChunk = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0)).buffer;
              setAudioDataChunks(prev => [...prev, audioChunk]);
            }
            
            if (data.is_last_chunk || data.metadata?.is_last_chunk) {
              addDebugMessage('✅ TTS generation complete');
              
              // Store generation ID for continuation if enabled and available
              if (continuationEnabled && generationId && setLastGenerationId) {
                setLastGenerationId(generationId);
                addDebugMessage(`🔗 Stored generation ID for continuation: ${generationId}`);
              }
              
              break;
            }
          } catch (e) {
            console.error('Error parsing chunk JSON:', e);
            // Skip invalid JSON lines
          }
        }
      }

      setIsGenerating(false);
      setConnectionStatus('TTS Complete');

    } catch (error) {
      console.error('TTS generation failed:', error);
      setIsGenerating(false);
      setConnectionStatus('TTS Failed');
      addDebugMessage(`❌ TTS error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return { generateTTSSpeech };
}