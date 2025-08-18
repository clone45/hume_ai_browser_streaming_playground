import { FileText, Mic, Loader2, StopCircle, Volume2, Play } from 'lucide-react';

interface PlayerStatus {
  queueSize: number;
  isPlaying: boolean;
  [key: string]: unknown;
}

interface TextInputPanelProps {
  mode: 'evi' | 'tts';
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
  description?: string;
  setDescription?: (description: string) => void;
  speed?: number;
  setSpeed?: (speed: number) => void;
  trailingSilence?: number;
  setTrailingSilence?: (silence: number) => void;
}

export function TextInputPanel({
  mode,
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
  description = '',
  setDescription,
  speed = 1.0,
  setSpeed,
  trailingSilence = 0,
  setTrailingSilence,
}: TextInputPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Text-to-Speech
      </h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Text to Convert to Speech:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to convert to speech... (e.g., 'Hello, this is a test of Hume AI text-to-speech!')"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          maxLength={1000}
        />
        <div className="text-xs text-gray-500 mt-1">
          {text.length}/1000 characters
        </div>
      </div>
      
      {mode === 'tts' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Custom Voice ID (optional):
            </label>
            <input
              type="text"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="e.g., your-custom-voice-id"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
          
          {/* Acting Instructions Controls */}
          <div className="mb-4 bg-green-50 p-4 rounded-md border border-green-200">
            <h3 className="text-sm font-medium text-green-900 mb-3">
              🎭 Acting Instructions
            </h3>
            
            {/* Description Field */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-green-700 mb-1">
                Description (emotions, delivery style):
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription?.(e.target.value)}
                placeholder="e.g., calm, whispering, excited, sarcastic"
                className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
              />
              <p className="text-xs text-green-600 mt-1">
                Use concise terms like &quot;excited, whispering&quot; or &quot;calm, pedagogical&quot;
              </p>
            </div>
            
            {/* Speed Control */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-green-700 mb-1">
                Speed: {speed}x {speed < 1 ? '(slower)' : speed > 1 ? '(faster)' : '(normal)'}
              </label>
              <input
                type="range"
                min="0.25"
                max="3.0"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed?.(parseFloat(e.target.value))}
                className="w-full h-1 bg-green-200 rounded-lg appearance-none cursor-pointer slider:bg-green-500"
              />
              <div className="flex justify-between text-xs text-green-600 mt-1">
                <span>0.25x</span>
                <span>1.0x</span>
                <span>3.0x</span>
              </div>
            </div>
            
            {/* Trailing Silence */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-green-700 mb-1">
                Trailing Silence: {trailingSilence}s
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={trailingSilence}
                onChange={(e) => setTrailingSilence?.(parseFloat(e.target.value))}
                className="w-full h-1 bg-green-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-green-600 mt-1">
                <span>0s</span>
                <span>5s</span>
                <span>10s</span>
              </div>
            </div>
          </div>
        </>
      )}
      
      <div className="flex gap-3 mb-4">
        <button
          onClick={onGenerateSpeech}
          disabled={
            mode === 'evi' 
              ? (!isConnected || !text.trim() || isGenerating)
              : (!text.trim() || isGenerating)
          }
          className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
            (mode === 'evi' ? (!isConnected || !text.trim() || isGenerating) : (!text.trim() || isGenerating))
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
          className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-md font-medium transition-colors flex items-center gap-2"
        >
          <StopCircle className="w-4 h-4" />
          Stop Audio
        </button>
        
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
              ⚡ Quick Examples
            </option>
            <option value="Hello! Welcome to the Hume AI text-to-speech playground.">
              Simple Greeting
            </option>
            <option value="This is a demonstration of Hume AI's Octave text-to-speech system streaming directly to your browser.">
              Technical Demo
            </option>
            <option value="The quick brown fox jumps over the lazy dog. This classic pangram contains every letter of the alphabet and is perfect for testing speech synthesis quality.">
              Longer Text
            </option>
            <option value="Wow, this is amazing! I can't believe how natural and clear this voice sounds. The technology is truly impressive.">
              Expressive Text
            </option>
            <optgroup label="🔗 Continuation Tests">
              <option value="What a fantastic performance!">
                Test 1: Performance Context
              </option>
              <option value="Now take a bow.">
                Test 2: &quot;bow&quot; (/bau/ - performer)
              </option>
              <option value="First take a quiver of arrows.">
                Test 3: Archery Context
              </option>
              <option value="Now take a bow.">
                Test 4: &quot;bow&quot; (/bō/ - weapon)
              </option>
              <option value="Our proposal has been accepted with full funding!">
                Test 5: Positive Context
              </option>
              <option value="I can't believe it!">
                Test 6: Should sound excited
              </option>
              <option value="After all our preparation... They've decided to cancel the entire project.">
                Test 7: Negative Context
              </option>
              <option value="I can't believe it!">
                Test 8: Should sound disappointed
              </option>
            </optgroup>
            <optgroup label="🎭 Acting Instructions Tests">
              <option value="Welcome to our meditation session.">
                Test 1: Try with &quot;calm, pedagogical&quot;
              </option>
              <option value="Are you serious right now?">
                Test 2: Try with &quot;sarcastic&quot;
              </option>
              <option value="We need to move, now!">
                Test 3: Try with &quot;urgent, panicked&quot;
              </option>
              <option value="I have something important to tell you.">
                Test 4: Try with &quot;whispering, hushed&quot;
              </option>
              <option value="Congratulations on your achievement!">
                Test 5: Try with &quot;excited, joyful&quot;
              </option>
              <option value="Let us begin by taking a deep breath in.">
                Test 6: Try slow speed (0.65x) + &quot;calm, serene&quot;
              </option>
            </optgroup>
          </select>
        </div>
      </div>
      
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