'use client';

import { 
  Activity,
  Clock,
  Database,
  AudioWaveform as WaveformIcon
} from 'lucide-react';

interface WebAudioStatsProps {
  webAudioStats: {
    audioContextState: string;
    currentTime: string;
    nextStartTime: string;
    bufferedTime: string;
    scheduledSources: number;
  };
}

export function WebAudioStats({ webAudioStats }: WebAudioStatsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Web Audio API Status
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded">
          <div className="font-semibold text-blue-800 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Context State
          </div>
          <div className={`text-lg ${
            webAudioStats.audioContextState === 'running' 
              ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {webAudioStats.audioContextState}
          </div>
        </div>
        
        <div className="bg-purple-50 p-3 rounded">
          <div className="font-semibold text-purple-800 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Buffer Time
          </div>
          <div className="text-lg text-purple-600">
            {webAudioStats.bufferedTime}
          </div>
        </div>
        
        <div className="bg-green-50 p-3 rounded">
          <div className="font-semibold text-green-800 flex items-center gap-2">
            <WaveformIcon className="w-4 h-4" />
            Active Sources
          </div>
          <div className="text-lg text-green-600">
            {webAudioStats.scheduledSources}
          </div>
        </div>
        
        <div className="bg-orange-50 p-3 rounded">
          <div className="font-semibold text-orange-800 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Current Time
          </div>
          <div className="text-lg text-orange-600">
            {webAudioStats.currentTime}s
          </div>
        </div>
      </div>
    </div>
  );
}