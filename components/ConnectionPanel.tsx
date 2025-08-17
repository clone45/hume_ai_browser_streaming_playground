import { Plug, Loader2, XCircle, CheckCircle, Shield, Globe } from 'lucide-react';

interface ConnectionPanelProps {
  mode: 'evi' | 'tts';
  isConnected: boolean;
  connectionStatus: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({ 
  mode, 
  isConnected, 
  connectionStatus, 
  onConnect, 
  onDisconnect 
}: ConnectionPanelProps) {
  const handleButtonClick = mode === 'evi' ? (isConnected ? onDisconnect : onConnect) : undefined;
  const isButtonDisabled = mode === 'tts' || connectionStatus === 'Connecting...';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Plug className="w-5 h-5" />
        Hume AI Connection
      </h2>
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={handleButtonClick}
          disabled={isButtonDisabled}
          className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
            mode === 'tts' 
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : isConnected 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : connectionStatus === 'Connecting...'
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {mode === 'tts' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              TTS Ready
            </>
          ) : connectionStatus === 'Connecting...' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : isConnected ? (
            <>
              <XCircle className="w-4 h-4" />
              Disconnect
            </>
          ) : (
            <>
              <Plug className="w-4 h-4" />
              Connect to Hume AI
            </>
          )}
        </button>
        
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500' : 
            connectionStatus === 'Connecting...' ? 'bg-yellow-500' :
            connectionStatus === 'Failed' ? 'bg-red-500' :
            'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">{connectionStatus}</span>
        </div>
      </div>
      
      <div className="text-sm text-gray-600 space-y-1">
        <p className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Authentication: Server-side token generation (secure)
        </p>
        <p className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Endpoint: {mode === 'evi' ? 'wss://api.hume.ai/v0/evi/chat' : 'https://api.hume.ai/v0/tts/stream/json'}
        </p>
      </div>
    </div>
  );
}