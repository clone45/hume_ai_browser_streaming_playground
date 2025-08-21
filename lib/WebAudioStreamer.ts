/**
 * Web Audio API Streamer - Sample-accurate gapless audio streaming
 * Designed for real-time TTS streaming with perfect chunk transitions
 */

export class WebAudioStreamer {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private bufferQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  
  // Callbacks
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private onLogMessage?: (message: string) => void;
  
  // Analytics
  private totalChunksReceived = 0;
  private totalChunksPlayed = 0;
  private audioDataChunks: ArrayBuffer[] = [];
  
  // Configuration
  private readonly BUFFER_AHEAD_TIME = 0.1; // 100ms buffer ahead
  private readonly MAX_BUFFER_SIZE = 10;
  
  constructor(
    onPlaybackStateChange?: (isPlaying: boolean) => void,
    onLogMessage?: (message: string) => void
  ) {
    this.onPlaybackStateChange = onPlaybackStateChange;
    this.onLogMessage = onLogMessage;
    
    // Initialize AudioContext
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create master gain for volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Initialize next start time
    this.nextStartTime = this.audioContext.currentTime + this.BUFFER_AHEAD_TIME;
    
    this.log('🎛️ Web Audio API initialized');
  }
  
  private log(message: string): void {
    if (this.onLogMessage) {
      const timestamp = new Date().toLocaleTimeString(undefined, { 
        hour12: false, 
        fractionalSecondDigits: 3 
      });
      this.onLogMessage(`[${timestamp}] ${message}`);
    }
  }
  
  /**
   * Add audio chunk for streaming playback
   */
  async enqueue(base64Data: string, isPCM: boolean = true): Promise<void> {
    if (!base64Data) return;
    
    try {
      const arrivalTime = this.audioContext.currentTime;
      this.log(`📦 Chunk received (${base64Data.length} chars base64, ${isPCM ? 'PCM' : 'MP3'})`);
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Store raw audio data for waveform analysis
      this.audioDataChunks.push(bytes.buffer.slice(0));
      
      let audioBuffer: AudioBuffer;
      
      if (isPCM) {
        // For PCM data, create AudioBuffer directly
        // Hume AI PCM is 48kHz, mono, 16-bit PCM
        const sampleRate = 48000;
        const numSamples = bytes.length / 2; // 16-bit = 2 bytes per sample
        
        audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert 16-bit PCM to float32
        const dataView = new DataView(bytes.buffer);
        for (let i = 0; i < numSamples; i++) {
          const sample = dataView.getInt16(i * 2, true); // little-endian
          channelData[i] = sample / 32768.0; // Convert to -1.0 to 1.0 range
        }
        
        this.log(`🔄 PCM converted to ${audioBuffer.length} samples (${audioBuffer.duration.toFixed(3)}s)`);
      } else {
        // For MP3, decode using Web Audio API
        audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));
        this.log(`🔄 MP3 decoded to ${audioBuffer.length} samples (${audioBuffer.duration.toFixed(3)}s)`);
      }
      
      // Drop oldest if buffer full
      if (this.bufferQueue.length >= this.MAX_BUFFER_SIZE) {
        this.log(`🗑️ Buffer full, dropping oldest chunk`);
        this.bufferQueue.shift();
        if (this.audioDataChunks.length > this.MAX_BUFFER_SIZE) {
          this.audioDataChunks.shift();
        }
      }
      
      // Add to buffer queue
      this.bufferQueue.push(audioBuffer);
      this.totalChunksReceived++;
      
      this.log(`📊 Queue size: ${this.bufferQueue.length}, Total chunks: ${this.totalChunksReceived}`);
      
      // Start playback if not already playing
      if (!this.isPlaying) {
        this.log(`▶️ Starting Web Audio playback`);
        this.startPlayback();
      } else {
        // Schedule any pending chunks
        this.scheduleChunks();
      }
      
    } catch (error) {
      this.log(`❌ Audio decode error: ${error}`);
      console.error('Web Audio decode error:', error);
    }
  }
  
  /**
   * Start playback and schedule all chunks
   */
  private startPlayback(): void {
    if (this.bufferQueue.length === 0) return;
    
    // Resume audio context if suspended (required for user interaction)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this.log('🎛️ Audio context resumed');
        this.continuePlayback();
      });
    } else {
      this.continuePlayback();
    }
  }
  
  private continuePlayback(): void {
    this.isPlaying = true;
    this.onPlaybackStateChange?.(true);
    
    // Set initial start time if needed
    const now = this.audioContext.currentTime;
    if (this.nextStartTime <= now) {
      this.nextStartTime = now + this.BUFFER_AHEAD_TIME;
    }
    
    this.scheduleChunks();
  }
  
  /**
   * Schedule all pending chunks for sample-accurate playback
   */
  private scheduleChunks(): void {
    const now = this.audioContext.currentTime;
    
    // Schedule all unscheduled chunks
    while (this.bufferQueue.length > 0) {
      const audioBuffer = this.bufferQueue.shift()!;
      
      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to output
      source.connect(this.masterGain);
      
      // Schedule for precise timing
      const startTime = this.nextStartTime;
      source.start(startTime);
      
      this.log(`🎵 Scheduled chunk #${this.totalChunksPlayed + 1} at ${startTime.toFixed(3)}s (${audioBuffer.duration.toFixed(3)}s duration)`);
      
      // Update next start time (perfect gapless timing)
      this.nextStartTime = startTime + audioBuffer.duration;
      
      // Track scheduled sources
      this.scheduledSources.push(source);
      this.totalChunksPlayed++;
      
      // Handle source completion
      source.onended = () => {
        // Remove from scheduled sources
        const index = this.scheduledSources.indexOf(source);
        if (index > -1) {
          this.scheduledSources.splice(index, 1);
        }
        
        this.log(`✅ Chunk completed at ${this.audioContext.currentTime.toFixed(3)}s`);
        
        // Check if all chunks finished
        if (this.scheduledSources.length === 0 && this.bufferQueue.length === 0) {
          this.log(`⏹️ All chunks completed, stopping playback`);
          this.isPlaying = false;
          this.onPlaybackStateChange?.(false);
        }
      };
    }
    
    // Log scheduling summary
    if (this.scheduledSources.length > 0) {
      const nextEnd = this.nextStartTime;
      const bufferTime = (nextEnd - now) * 1000;
      this.log(`⏰ ${this.scheduledSources.length} chunks scheduled, buffer: ${bufferTime.toFixed(1)}ms`);
    }
  }
  
  /**
   * Stop all audio playback
   */
  stop(): void {
    this.log(`🛑 Stopping all audio sources`);
    
    // Stop all scheduled sources
    this.scheduledSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    
    // Clear everything
    this.scheduledSources = [];
    this.bufferQueue = [];
    this.isPlaying = false;
    this.onPlaybackStateChange?.(false);
    
    // Reset timing
    this.nextStartTime = this.audioContext.currentTime + this.BUFFER_AHEAD_TIME;
  }
  
  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
    this.log(`🔊 Volume set to ${Math.round(clampedVolume * 100)}%`);
  }
  
  /**
   * Get audio data for waveform analysis
   */
  getAudioDataChunks(): ArrayBuffer[] {
    return [...this.audioDataChunks];
  }
  
  /**
   * Reset for new session
   */
  resetSession(): void {
    this.stop();
    this.totalChunksReceived = 0;
    this.totalChunksPlayed = 0;
    this.audioDataChunks = [];
    this.log(`🔄 Session reset`);
  }
  
  /**
   * Get status for UI
   */
  getStatus() {
    const now = this.audioContext.currentTime;
    const bufferedTime = Math.max(0, (this.nextStartTime - now) * 1000);
    
    return {
      isPlaying: this.isPlaying,
      queueSize: this.bufferQueue.length + this.scheduledSources.length,
      analytics: {
        totalChunksReceived: this.totalChunksReceived,
        totalChunksPlayed: this.totalChunksPlayed,
        bufferUnderruns: 0, // Web Audio API handles this internally
        bufferOverflows: 0,
        averageChunkDuration: 0,
        minQueueSize: 0,
        maxQueueSize: 0,
        totalPlaybackTime: 0,
        bufferStarvationTime: 0,
        consecutiveUnderruns: 0,
        isBuffering: this.scheduledSources.length === 0 && this.bufferQueue.length > 0
      },
      bufferHealth: {
        isHealthy: bufferedTime > 100 || this.scheduledSources.length > 0, // >100ms buffer OR actively playing
        healthScore: Math.min(100, Math.max(0, 
          this.scheduledSources.length > 0 ? 100 : // If actively playing, full score
          bufferedTime / 5 // Otherwise 500ms buffer = 100 score
        )), 
        issues: this.scheduledSources.length === 0 && this.bufferQueue.length === 0 && this.isPlaying ? 
          ['No scheduled audio sources'] : 
          bufferedTime < 50 && this.bufferQueue.length === 0 ? ['Low scheduling buffer'] : []
      },
      webAudioStats: {
        audioContextState: this.audioContext.state,
        currentTime: now.toFixed(3),
        nextStartTime: this.nextStartTime.toFixed(3),
        bufferedTime: bufferedTime.toFixed(1) + 'ms',
        scheduledSources: this.scheduledSources.length
      }
    };
  }
}