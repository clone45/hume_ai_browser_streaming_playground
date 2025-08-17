import { useRef } from 'react';
import { WebAudioStreamer } from '@/lib/WebAudioStreamer';

interface UseTTSStreamProps {
  audioStreamerRef: React.RefObject<WebAudioStreamer | null>;
  addDebugMessage: (message: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setConnectionStatus: (status: string) => void;
  setAudioDataChunks: React.Dispatch<React.SetStateAction<ArrayBuffer[]>>;
  continuationEnabled?: boolean;
  lastGenerationId?: string | null;
  setLastGenerationId?: (id: string | null) => void;
  description?: string;
  speed?: number;
  trailingSilence?: number;
}

export function useTTSStream({
  audioStreamerRef,
  addDebugMessage,
  setIsGenerating,
  setConnectionStatus,
  setAudioDataChunks,
  continuationEnabled = false,
  lastGenerationId = null,
  setLastGenerationId,
  description = '',
  speed = 1.0,
  trailingSilence = 0,
}: UseTTSStreamProps) {
  
  const generateTTSSpeech = async (text: string, voiceId: string = '') => {
    if (!text.trim()) return;

    setIsGenerating(true);
    setConnectionStatus('Generating...');
    addDebugMessage(`🎤 Generating TTS for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
      // Reset analytics for new session
      audioStreamerRef.current?.resetSession();
      setAudioDataChunks([]);

      // Prepare payload - let's try the simpler format that Hume's docs show
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

      // Log what we're sending
      console.log('Sending payload:', payload);
      addDebugMessage(`📝 Payload: ${JSON.stringify(payload)}`);

      // Add voice config if provided
      if (voiceId?.trim()) {
        // Try without provider first - Hume might auto-detect
        payload.voice = voiceId.trim();
        addDebugMessage(`🎤 Using voice ID: ${voiceId.trim()}`);
      }

      // Add acting instructions if provided
      if (description?.trim()) {
        payload.description = description.trim();
        addDebugMessage(`🎭 Using acting instructions: "${description.trim()}"`);
      }

      if (speed !== 1.0) {
        payload.speed = speed;
        addDebugMessage(`⚡ Using speed: ${speed}x`);
      }

      if (trailingSilence > 0) {
        payload.trailing_silence = trailingSilence;
        addDebugMessage(`⏸️ Using trailing silence: ${trailingSilence}s`);
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
            
            // Capture generation ID from response
            if (data.generation_id) {
              generationId = data.generation_id;
              addDebugMessage(`🔗 Received generation ID: ${generationId}`);
            } else if (data.metadata?.generation_id) {
              generationId = data.metadata.generation_id;
              addDebugMessage(`🔗 Received generation ID from metadata: ${generationId}`);
            }
            
            if (data.audio && audioStreamerRef.current) {
              console.log(`🔊 Received PCM audio chunk (${data.audio.length} chars)`);
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