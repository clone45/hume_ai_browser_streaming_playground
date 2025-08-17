'use client';

import { Bug, Copy, Trash2 } from 'lucide-react';

interface DebugConsoleProps {
  debugLog: string[];
  onCopyLogs: () => void;
  onClearLog: () => void;
}

export function DebugConsole({ debugLog, onCopyLogs, onClearLog }: DebugConsoleProps) {
  return (
    <div className="bg-gray-900 text-green-400 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bug className="w-5 h-5" />
          Debug Console
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCopyLogs}
            disabled={debugLog.length === 0}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-green-400 rounded text-sm transition-colors flex items-center gap-2"
          >
            <Copy className="w-3 h-3" />
            Copy Logs
          </button>
          <button
            onClick={onClearLog}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-green-400 rounded text-sm transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Clear Log
          </button>
        </div>
      </div>
      <div className="font-mono text-sm h-64 overflow-y-auto">
        {debugLog.length === 0 ? (
          <div className="text-gray-500">Debug messages will appear here...</div>
        ) : (
          debugLog.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}