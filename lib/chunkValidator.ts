/**
 * Chunk validation system to detect and discard stale audio chunks
 * from previous TTS generations after interruptions
 */

export interface ChunkValidationResult {
  isValid: boolean;
  newPosition: number;
  reason?: string;
  expectedNext?: string;
}

export class ChunkValidator {
  private expectedText: string = '';

  /**
   * Set the expected text for the current text chunk batch
   */
  setExpectedText(text: string): void {
    this.expectedText = text.trim();
  }

  /**
   * Reset the validator (rejects all chunks until new expected text is set)
   */
  reset(): void {
    this.expectedText = '';
  }

  /**
   * Validate an incoming audio chunk based on text batch matching
   */
  validateChunk(incomingText: string): ChunkValidationResult {
    // If no expected text is set, reject all chunks
    if (!this.expectedText) {
      return {
        isValid: false,
        newPosition: 0,
        reason: 'No expected text set - rejecting all chunks (validator reset or idle)'
      };
    }

    // Clean up the incoming text (trim whitespace, normalize)
    const cleanIncomingText = incomingText.trim();
    
    if (!cleanIncomingText) {
      return {
        isValid: false,
        newPosition: 0,
        reason: 'Empty or whitespace-only chunk'
      };
    }

    // Simple exact text matching - chunk belongs to current text batch
    if (cleanIncomingText === this.expectedText) {
      return {
        isValid: true,
        newPosition: 0,
        reason: `Valid chunk matches expected text batch: "${this.expectedText.substring(0, 50)}..."`
      };
    }

    // Text doesn't match - could be stale or future chunk
    return {
      isValid: false,
      newPosition: 0,
      reason: `Text batch mismatch. Expected: "${this.expectedText.substring(0, 30)}...", Got: "${cleanIncomingText.substring(0, 30)}..."`
    };
  }

  /**
   * Apply validation result (no-op since we don't track position)
   */
  applyValidation(result: ChunkValidationResult): void {
    // No state to update - text batch validation is stateless
  }

  /**
   * Get current validation state
   */
  getState() {
    return {
      expectedText: this.expectedText,
      isActive: this.expectedText !== ''
    };
  }

  /**
   * Check if validation is active (has expected text set)
   */
  isActive(): boolean {
    return this.expectedText !== '';
  }

  /**
   * Get current expected text
   */
  getExpectedText(): string {
    return this.expectedText;
  }
}