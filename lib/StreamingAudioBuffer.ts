// Simplified StreamingAudioBuffer for playground demonstration
// This shows the core concepts from the architecture document

export interface BufferedAudioChunk {
  audioData: string[]; // Array of base64 audio segments for this chunk
  chunkIndex: number;
  timestamp: number;
  isComplete: boolean; // Track if this chunk is complete
}

export class StreamingAudioBuffer {
  private audioQueue: BufferedAudioChunk[] = [];
  private nextExpectedIndex: number = 0;
  private processedChunks: Set<number> = new Set(); // Track chunks that have been released
  private onAudioReadyCallback?: (audioData: string, chunkIndex: number) => void;
  private onBufferStatusCallback?: (queuedChunks: number, nextExpected: number) => void;
  
  constructor() {
    console.log('🎯 BUFFER: StreamingAudioBuffer initialized');
  }
  
  // Add audio chunk to buffer (may arrive out of order)
  addAudioChunk(audioData: string, chunkIndex: number, isComplete: boolean = false): void {
    // Skip if this chunk was already processed and released
    if (this.processedChunks.has(chunkIndex)) {
      console.log(`⚠️  BUFFER: Chunk ${chunkIndex} already processed and released, skipping`);
      return;
    }
    
    const timestamp = Date.now();
    console.log(`📥 BUFFER: Received audio segment for chunk ${chunkIndex} (expecting ${this.nextExpectedIndex}), complete: ${isComplete}`);
    
    // Find existing chunk or create new one
    let existingChunk = this.audioQueue.find(c => c.chunkIndex === chunkIndex);
    
    if (existingChunk) {
      // Add audio segment to existing chunk
      existingChunk.audioData.push(audioData);
      existingChunk.isComplete = isComplete;
      console.log(`🔗 BUFFER: Added segment to existing chunk ${chunkIndex}, total segments: ${existingChunk.audioData.length}`);
    } else {
      // Create new chunk
      const chunk: BufferedAudioChunk = {
        audioData: [audioData],
        chunkIndex,
        timestamp,
        isComplete
      };
      
      // Insert chunk in correct position by index
      this.insertChunkInOrder(chunk);
      console.log(`📋 BUFFER: Created new chunk ${chunkIndex} with first segment`);
    }
    
    // Process any ready chunks in sequence
    this.processReadyChunks();
    
    // Notify listeners of buffer status
    this.onBufferStatusCallback?.(this.audioQueue.length, this.nextExpectedIndex);
  }
  
  private insertChunkInOrder(newChunk: BufferedAudioChunk): void {
    // Check if this chunk already exists
    const existingIndex = this.audioQueue.findIndex(c => c.chunkIndex === newChunk.chunkIndex);
    if (existingIndex >= 0) {
      console.log(`⚠️  BUFFER: Chunk ${newChunk.chunkIndex} already exists, skipping`);
      return;
    }
    
    // Find insertion point to maintain order by chunkIndex
    let insertIndex = 0;
    while (insertIndex < this.audioQueue.length && 
           this.audioQueue[insertIndex].chunkIndex < newChunk.chunkIndex) {
      insertIndex++;
    }
    
    this.audioQueue.splice(insertIndex, 0, newChunk);
    console.log(`📋 BUFFER: Inserted chunk ${newChunk.chunkIndex} at position ${insertIndex}`);
  }
  
  private processReadyChunks(): void {
    console.log(`🔍 BUFFER: Processing ready chunks. Queue length: ${this.audioQueue.length}, expecting: ${this.nextExpectedIndex}`);
    if (this.audioQueue.length > 0) {
      console.log(`🔍 BUFFER: First chunk in queue has index: ${this.audioQueue[0].chunkIndex}`);
    }
    
    // Send out chunks that are ready (in correct sequence order)
    while (this.audioQueue.length > 0 && 
           this.audioQueue[0].chunkIndex === this.nextExpectedIndex &&
           this.audioQueue[0].isComplete) {
      
      const readyChunk = this.audioQueue.shift()!;
      
      console.log(`🔊 BUFFER: Releasing chunk ${readyChunk.chunkIndex} for playback (${readyChunk.audioData.length} segments)`);
      console.log(`📊 BUFFER: Queue status - ${this.audioQueue.length} chunks remaining, next expected: ${this.nextExpectedIndex + 1}`);
      
      // Combine all audio segments for this chunk
      const combinedAudio = readyChunk.audioData.join('');
      
      // Send to audio streamer for immediate playback
      this.onAudioReadyCallback?.(combinedAudio, readyChunk.chunkIndex);
      
      // Mark this chunk as processed so we don't accept more segments for it
      this.processedChunks.add(readyChunk.chunkIndex);
      
      this.nextExpectedIndex++;
    }
    
    if (this.audioQueue.length > 0) {
      console.log(`⏳ BUFFER: Still waiting for chunk ${this.nextExpectedIndex}, have chunks: [${this.audioQueue.map(c => c.chunkIndex).join(', ')}]`);
    }
  }
  
  // Check what chunks are waiting in buffer
  getBufferStatus(): {
    queuedChunks: number;
    nextExpectedIndex: number;
    waitingIndexes: number[];
  } {
    return {
      queuedChunks: this.audioQueue.length,
      nextExpectedIndex: this.nextExpectedIndex,
      waitingIndexes: this.audioQueue.map(c => c.chunkIndex)
    };
  }
  
  // Reset buffer for new generation
  reset(): void {
    this.audioQueue = [];
    this.nextExpectedIndex = 0;
    this.processedChunks.clear();
    console.log('🔄 BUFFER: Reset for new generation');
  }
  
  // Set callback for when audio is ready to play
  onAudioReady(callback: (audioData: string, chunkIndex: number) => void): void {
    this.onAudioReadyCallback = callback;
  }
  
  // Set callback for buffer status updates
  onBufferStatus(callback: (queuedChunks: number, nextExpected: number) => void): void {
    this.onBufferStatusCallback = callback;
  }
  
  // Get debug information
  getDebugInfo(): string {
    const status = this.getBufferStatus();
    return `Buffer: ${status.queuedChunks} chunks waiting, expecting #${status.nextExpectedIndex}, have: [${status.waitingIndexes.join(', ')}]`;
  }
}