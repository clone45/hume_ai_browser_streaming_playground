interface ModeSelectorProps {
  mode: 'evi' | 'tts';
  onModeChange: (mode: 'evi' | 'tts') => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">API Mode</h2>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="evi"
            checked={mode === 'evi'}
            onChange={(e) => onModeChange(e.target.value as 'evi' | 'tts')}
            className="w-4 h-4"
          />
          <span>EVI Chat (WebSocket)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="tts"
            checked={mode === 'tts'}
            onChange={(e) => onModeChange(e.target.value as 'evi' | 'tts')}
            className="w-4 h-4"
          />
          <span>TTS Stream (REST)</span>
        </label>
      </div>
    </div>
  );
}