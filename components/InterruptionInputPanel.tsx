import { FileText, Mic, Loader2, StopCircle, Volume2, Play, Zap, Layers } from 'lucide-react';
import { interruptionTestTexts } from '@/lib/textChunker';

interface PlayerStatus {
  queueSize: number;
  isPlaying: boolean;
  [key: string]: unknown;
}

interface InterruptionInputPanelProps {
  text: string;
  setText: (text: string) => void;
  voiceId: string;
  setVoiceId: (voiceId: string) => void;
  isConnected: boolean;
  isGenerating: boolean;
  isPlayingAudio: boolean;
  volume: number;
  audioAnalytics: Record<string, unknown> | null;
  playerStatus: PlayerStatus;
  onGenerateSpeech: () => void;
  onStopAudio: () => void;
  onVolumeChange: (volume: number) => void;
  continuationEnabled?: boolean;
  setContinuationEnabled?: (enabled: boolean) => void;
  lastGenerationId?: string | null;
  onResetContinuation?: () => void;
  // Chunked streaming props
  chunks?: { text: string; index: number; isComplete: boolean }[];
  currentChunkIndex?: number;
  onStopGeneration?: () => void;
}

export function InterruptionInputPanel({
  text,
  setText,
  voiceId,
  setVoiceId,
  isConnected,
  isGenerating,
  isPlayingAudio,
  volume,
  audioAnalytics,
  playerStatus,
  onGenerateSpeech,
  onStopAudio,
  onVolumeChange,
  continuationEnabled = false,
  setContinuationEnabled,
  lastGenerationId,
  onResetContinuation,
  chunks = [],
  currentChunkIndex = -1,
  onStopGeneration,
}: InterruptionInputPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5" />
        Interruption Testing
      </h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Text to Convert to Speech:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter longer text to test interruption scenarios... (e.g., a paragraph that takes several seconds to speak)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          maxLength={1000}
        />
        <div className="text-xs text-gray-500 mt-1">
          {text.length}/1000 characters
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-red-600">
          Voice ID (required for instant mode):
        </label>
        <input
          type="text"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          placeholder="e.g., your-custom-voice-id (required)"
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
            voiceId.trim() 
              ? 'border-gray-300 focus:ring-blue-500' 
              : 'border-red-300 focus:ring-red-500 bg-red-50'
          }`}
          required
        />
        {!voiceId.trim() && (
          <p className="text-xs text-red-600 mt-1">
            Voice ID is required for instant mode and optimal streaming performance
          </p>
        )}
      </div>
      
      {/* Continuation Controls */}
      <div className="mb-4 bg-blue-50 p-4 rounded-md border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-blue-900">
            🔗 Continuation (Contextual TTS)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={continuationEnabled}
              onChange={(e) => setContinuationEnabled?.(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-blue-700">Enable</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mb-2">
          Maintains context across multiple TTS requests for better pronunciation, emotional continuity, and voice consistency.
        </p>
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="text-blue-700">Status: </span>
            <span className={continuationEnabled ? 'text-green-600' : 'text-gray-500'}>
              {continuationEnabled ? 'Enabled' : 'Disabled'}
            </span>
            {continuationEnabled && lastGenerationId && (
              <>
                <br />
                <span className="text-blue-700">Context ID: </span>
                <span className="font-mono text-xs bg-blue-100 px-1 rounded">
                  {lastGenerationId.substring(0, 8)}...
                </span>
              </>
            )}
          </div>
          {continuationEnabled && onResetContinuation && (
            <button
              onClick={onResetContinuation}
              className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-800 px-2 py-1 rounded transition-colors"
            >
              Reset Context
            </button>
          )}
        </div>
      </div>
      
      <div className="flex gap-3 mb-4">
        <button
          onClick={onGenerateSpeech}
          disabled={!text.trim() || isGenerating || !voiceId.trim()}
          className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
            (!text.trim() || isGenerating || !voiceId.trim())
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Generate Speech
            </>
          )}
        </button>
        
        <button
          onClick={onStopAudio}
          disabled={!isPlayingAudio && playerStatus.queueSize === 0}
          className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
            (!isPlayingAudio && playerStatus.queueSize === 0)
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          <StopCircle className="w-4 h-4" />
          Interrupt Audio
        </button>
        
        {isGenerating && onStopGeneration && (
          <button
            onClick={onStopGeneration}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium transition-colors flex items-center gap-2"
          >
            <StopCircle className="w-4 h-4" />
            Stop Generation
          </button>
        )}
        
        {/* Quick Test Examples Dropdown */}
        <div className="relative">
          <select
            onChange={(e) => {
              if (e.target.value) {
                setText(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors appearance-none cursor-pointer flex items-center gap-2"
            defaultValue=""
          >
            <option value="" hidden>
              ⚡ Streaming Examples
            </option>
            {interruptionTestTexts.map((example) => (
              <option key={example.id} value={example.text}>
                {example.title} - {example.description}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Generation Status */}
      {isGenerating && chunks.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="font-medium text-blue-800 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Streaming Generation in Progress
          </div>
          <div className="text-sm text-blue-600 mt-1">
            Processing chunk {currentChunkIndex + 1} of {chunks.length}
          </div>
          {currentChunkIndex >= 0 && currentChunkIndex < chunks.length && (
            <div className="text-xs text-blue-500 mt-1 font-mono bg-blue-100 p-2 rounded">
              "{chunks[currentChunkIndex]?.text.substring(0, 100)}..."
            </div>
          )}
        </div>
      )}
      
      {/* Chunk Preview */}
      {chunks.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="font-medium text-gray-800 mb-2 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Text Chunks ({chunks.length} chunks)
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {chunks.map((chunk, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs border ${
                  isGenerating && index === currentChunkIndex
                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                    : index <= currentChunkIndex
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <span className="font-medium">
                  Chunk {index + 1}
                  {index <= currentChunkIndex ? ' ✓' : ''}
                  {isGenerating && index === currentChunkIndex ? ' 🔄' : ''}:
                </span>
                <span className="ml-2">{chunk.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Audio Controls */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          Audio Controls
        </h3>
        <div className="flex items-center gap-4 mb-3">
          <span className="text-sm font-medium">Volume:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono w-12">{Math.round(volume * 100)}%</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            {isPlayingAudio ? (
              <span className="text-green-600 flex items-center gap-1">
                <Play className="w-3 h-3" /> Playing
              </span>
            ) : (
              <span className="text-gray-600 flex items-center gap-1">
                <StopCircle className="w-3 h-3" /> Stopped
              </span>
            )}
          </div>
          <div>
            <span className="font-medium">Queue:</span>{' '}
            <span className="text-blue-600">{playerStatus.queueSize} chunks</span>
          </div>
          <div>
            <span className="font-medium">Chunks:</span>{' '}
            <span className="text-purple-600">
              {(audioAnalytics?.totalChunksReceived as number) || 0} received
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}