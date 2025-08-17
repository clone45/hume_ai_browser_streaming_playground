import React, { useRef, useEffect, useState } from 'react';
import { Play, Square, RotateCcw, AudioWaveform as WaveformIcon } from 'lucide-react';

interface AudioWaveformProps {
  audioChunks: ArrayBuffer[];
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ 
  audioChunks, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [totalSamples, setTotalSamples] = useState(0);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackPosition, setCurrentPlaybackPosition] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Convert AudioBuffer to WAV blob utility
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Parse audio data using Web Audio API (same as WebAudioStreamer)
  const parseWavData = async (arrayBuffer: ArrayBuffer): Promise<Float32Array> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // Extract channel data (assume mono or use first channel)
      const channelData = audioBuffer.getChannelData(0);
      return new Float32Array(channelData);
    } catch (error) {
      console.error('Error decoding audio chunk:', error);
      return new Float32Array(0);
    }
  };

  // Combine all audio chunks into one continuous waveform using Web Audio API
  const combineAudioData = async (): Promise<Float32Array> => {
    if (audioChunks.length === 0) return new Float32Array(0);
    
    const allSamples: Float32Array[] = [];
    
    for (const chunk of audioChunks) {
      const samples = await parseWavData(chunk);
      allSamples.push(samples);
    }
    
    const totalLength = allSamples.reduce((sum, samples) => sum + samples.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    
    for (const samples of allSamples) {
      combined.set(samples, offset);
      offset += samples.length;
    }
    
    return combined;
  };

  // Draw waveform on canvas
  const drawWaveform = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const audioData = await combineAudioData();
    if (audioData.length === 0) {
      // Clear canvas if no data
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw "No Audio Data" message
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No Audio Data', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    setTotalSamples(audioData.length);
    
    const height = canvas.height;
    const width = canvas.width;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1F2937'; // Dark background
    ctx.fillRect(0, 0, width, height);
    
    // Calculate samples per pixel based on zoom and scroll (allow sub-sample precision)
    const samplesPerPixel = audioData.length / (width * zoom);
    const startSample = Math.floor(scrollPosition * audioData.length);
    const endSample = Math.min(audioData.length, startSample + (width * samplesPerPixel));
    
    // Draw waveform
    ctx.strokeStyle = '#10B981'; // Green waveform
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    let isFirstPoint = true;
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + (x * samplesPerPixel);
      
      if (sampleIndex >= endSample) break;
      
      let amplitude;
      
      if (samplesPerPixel >= 1) {
        // Multiple samples per pixel - use RMS
        let rmsValue = 0;
        let count = 0;
        
        for (let s = 0; s < samplesPerPixel && Math.floor(sampleIndex + s) < audioData.length; s++) {
          const sample = audioData[Math.floor(sampleIndex + s)];
          rmsValue += sample * sample;
          count++;
        }
        
        amplitude = Math.sqrt(rmsValue / Math.max(count, 1));
      } else {
        // Less than one sample per pixel - interpolate between samples
        const floorIndex = Math.floor(sampleIndex);
        const ceilIndex = Math.min(floorIndex + 1, audioData.length - 1);
        const fraction = sampleIndex - floorIndex;
        
        if (floorIndex < audioData.length && ceilIndex < audioData.length) {
          const sample1 = audioData[floorIndex];
          const sample2 = audioData[ceilIndex];
          amplitude = Math.abs(sample1 + (sample2 - sample1) * fraction);
        } else if (floorIndex < audioData.length) {
          amplitude = Math.abs(audioData[floorIndex]);
        } else {
          amplitude = 0;
        }
      }
      
      // Convert to canvas coordinates (apply vertical zoom, draw from bottom up)
      const y = height - (amplitude * height * 0.9 * verticalZoom);
      
      if (isFirstPoint) {
        ctx.moveTo(x, y);
        isFirstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw baseline at bottom
    ctx.strokeStyle = '#6B7280'; // Gray baseline
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Draw chunk boundaries (simplified - will be drawn after chunks are processed)
    if (audioChunks.length > 1) {
      ctx.strokeStyle = '#EF4444'; // Red chunk boundaries
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      // For now, draw boundaries at estimated positions
      // TODO: Implement proper async chunk boundary calculation
      const estimatedChunkDuration = audioData.length / audioChunks.length;
      for (let i = 1; i < audioChunks.length; i++) {
        const estimatedBoundary = i * estimatedChunkDuration;
        const x = ((estimatedBoundary - startSample) / samplesPerPixel);
        
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
    
    // Draw playback position indicator
    if (audioChunks.length > 0 && totalSamples > 0) {
      // Get sample rate - either from WAV header or use default
      let actualSampleRate = 48000; // Default TTS sample rate
      
      if (audioChunks[0].byteLength >= 28) {
        const firstChunkView = new DataView(audioChunks[0]);
        const isWavFile = firstChunkView.getUint32(0, false) === 0x52494646 && // "RIFF"
                         firstChunkView.getUint32(8, false) === 0x57415645;   // "WAVE"
        
        if (isWavFile) {
          actualSampleRate = firstChunkView.getUint32(24, true);
        }
      }
      
      const playbackSample = currentPlaybackPosition * actualSampleRate;
      const playbackX = ((playbackSample - startSample) / samplesPerPixel);
      
      if (playbackX >= 0 && playbackX <= width) {
        ctx.strokeStyle = '#F59E0B'; // Orange playback line
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(playbackX, 0);
        ctx.lineTo(playbackX, height);
        ctx.stroke();
      }
    }
    
    // Draw sample info
    ctx.fillStyle = '#F3F4F6';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Samples: ${audioData.length.toLocaleString()}`, 10, 20);
    ctx.fillText(`Chunks: ${audioChunks.length}`, 10, 35);
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, 10, 50);
    ctx.fillText(`Samples/px: ${samplesPerPixel.toFixed(2)}`, 10, 65);
    
    if (isPlaying || currentPlaybackPosition > 0) {
      ctx.fillText(`Time: ${currentPlaybackPosition.toFixed(2)}s`, 10, 80);
    }
  };

  // Update canvas size when container resizes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth - 20; // Padding
        setCanvasWidth(width);
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Redraw when data or settings change
  useEffect(() => {
    drawWaveform();
  }, [audioChunks, scrollPosition, zoom, verticalZoom, canvasWidth, currentPlaybackPosition]);

  const handleScroll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrollPosition(parseFloat(e.target.value));
  };

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleVerticalZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVerticalZoom(parseFloat(e.target.value));
  };

  // Create combined audio blob from all chunks using Web Audio API (like WebAudioStreamer)
  const createCombinedAudioBlob = async (): Promise<Blob | null> => {
    if (audioChunks.length === 0) return null;
    
    try {
      // Use Web Audio API to decode each chunk (same as WebAudioStreamer)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffers: AudioBuffer[] = [];
      
      for (const chunk of audioChunks) {
        try {
          const audioBuffer = await audioContext.decodeAudioData(chunk.slice(0));
          decodedBuffers.push(audioBuffer);
          console.log(`Audio Waveform Debug - Decoded chunk: ${audioBuffer.length} samples, ${audioBuffer.duration.toFixed(3)}s`);
        } catch (decodeError) {
          console.error('Audio Waveform Debug - Failed to decode chunk:', decodeError);
        }
      }
      
      if (decodedBuffers.length === 0) {
        console.error('Audio Waveform Debug - No chunks could be decoded');
        return null;
      }
      
      // Combine all decoded buffers into one
      const totalLength = decodedBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const sampleRate = decodedBuffers[0].sampleRate;
      const numChannels = decodedBuffers[0].numberOfChannels;
      
      const combinedBuffer = audioContext.createBuffer(numChannels, totalLength, sampleRate);
      
      let offset = 0;
      for (const buffer of decodedBuffers) {
        for (let channel = 0; channel < numChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          combinedBuffer.getChannelData(channel).set(channelData, offset);
        }
        offset += buffer.length;
      }
      
      // Convert back to WAV blob for playback
      return audioBufferToWav(combinedBuffer);
      
    } catch (error) {
      console.error('Audio Waveform Debug - Failed to combine audio:', error);
      return null;
    }
  };

  // Playback controls
  const handlePlay = async () => {
    const audioBlob = await createCombinedAudioBlob();
    if (!audioBlob) return;
    
    if (audioRef.current) {
      URL.revokeObjectURL(audioRef.current.src);
    }
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.currentTime = currentPlaybackPosition;
    
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentPlaybackPosition(0);
    };
    
    audio.ontimeupdate = () => {
      setCurrentPlaybackPosition(audio.currentTime);
    };
    
    audioRef.current = audio;
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(console.error);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPlaybackPosition(0);
  };

  const handleRewind = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentPlaybackPosition(0);
    } else {
      setCurrentPlaybackPosition(0);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <WaveformIcon className="w-5 h-5" />
          Audio Waveform Analysis
        </h2>
        
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            disabled={audioChunks.length === 0 || isPlaying}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Play className="w-3 h-3" />
            Play
          </button>
          <button
            onClick={handleStop}
            disabled={audioChunks.length === 0}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <Square className="w-3 h-3" />
            Stop
          </button>
          <button
            onClick={handleRewind}
            disabled={audioChunks.length === 0}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Rewind
          </button>
        </div>
      </div>
      
      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="w-full mb-4 border-2 border-gray-300 rounded"
        style={{ height: '200px' }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={200}
          className="w-full h-full"
          style={{ display: 'block' }}
        />
      </div>
      
      {/* Controls */}
      <div className="space-y-4">
        {/* Scroll Control */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium w-16">Scroll:</label>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.01"
            value={scrollPosition}
            onChange={handleScroll}
            className="flex-1"
            disabled={totalSamples === 0}
          />
          <span className="text-xs text-gray-600 w-16">
            {(scrollPosition * 100).toFixed(0)}%
          </span>
        </div>
        
        {/* Horizontal Zoom Control */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium w-20">H-Zoom:</label>
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={zoom}
            onChange={handleZoom}
            className="flex-1"
            disabled={totalSamples === 0}
          />
          <span className="text-xs text-gray-600 w-20">
            {zoom.toFixed(1)}x
          </span>
        </div>
        
        {/* Vertical Zoom Control */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium w-20">V-Zoom:</label>
          <input
            type="range"
            min="0.1"
            max="50"
            step="0.1"
            value={verticalZoom}
            onChange={handleVerticalZoom}
            className="flex-1"
            disabled={totalSamples === 0}
          />
          <span className="text-xs text-gray-600 w-20">
            {verticalZoom.toFixed(1)}x
          </span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 text-xs text-gray-600 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-500"></div>
          <span>Waveform</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500 border-dashed border-t"></div>
          <span>Chunk Boundaries (gaps indicate pops/clicks)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-500"></div>
          <span>Baseline (0.0 amplitude)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-orange-500"></div>
          <span>Playback Position</span>
        </div>
      </div>
    </div>
  );
};