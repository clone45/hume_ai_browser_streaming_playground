import { Database, FileText, Download } from 'lucide-react';

interface ChunkInfo {
  chunkNumber: number;
  timestamp: string;
  rawData: any;
  audioDataLength?: number;
  processingTime?: number;
  receivedAt: number;
}

interface AudioChunkInfoPanelProps {
  chunkInfos: ChunkInfo[];
  onClearChunks: () => void;
}

export function AudioChunkInfoPanel({
  chunkInfos,
  onClearChunks,
}: AudioChunkInfoPanelProps) {
  
  const exportToCSV = () => {
    // CSV headers optimized for interruption analysis
    const headers = [
      'Timestamp',
      'Parent Chunk',
      'Chunk Index',
      'Last Chunk',
      'Audio Size',
      'Text (First 30 chars)',
      'Expected Text (First 30 chars)',
      'Validation Status',
      'Interruption Event'
    ];
    
    // Convert chunk data to CSV rows
    const rows = chunkInfos.map((chunk, index) => {
      const chunkText = chunk.rawData?.transcribed_text || chunk.rawData?.text || '';
      const expectedText = chunk.validation?.expectedText || '';
      const timestamp = new Date(chunk.timestamp).toLocaleTimeString(undefined, { 
        hour12: false, 
        fractionalSecondDigits: 3 
      });
      
      // Determine interruption event
      let interruptionEvent = '';
      if (chunk.parentChunkIndex === -1) {
        interruptionEvent = 'SYSTEM_RESPONSE';
      } else if (chunk.validation?.isValid === false && chunk.validation?.reason?.includes('batch mismatch')) {
        interruptionEvent = 'STALE_CHUNK';
      } else if (index > 0 && chunkInfos[index - 1].parentChunkIndex !== chunk.parentChunkIndex) {
        interruptionEvent = 'NEW_TEXT_BATCH';
      }
      
      return [
        timestamp,
        chunk.parentChunkIndex !== undefined ? chunk.parentChunkIndex.toString() : '',
        chunk.rawData?.chunk_index !== undefined ? chunk.rawData.chunk_index.toString() : '',
        chunk.rawData?.is_last_chunk ? 'true' : 'false',
        chunk.audioDataLength || '0',
        chunkText.substring(0, 30) + (chunkText.length > 30 ? '...' : ''),
        expectedText.substring(0, 30) + (expectedText.length > 30 ? '...' : ''),
        chunk.validation?.isValid === true ? 'VALID' : chunk.validation?.isValid === false ? 'DISCARDED' : 'UNKNOWN',
        interruptionEvent
      ];
    });
    
    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audio_chunks_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" />
          Audio Chunk Information
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {chunkInfos.length} chunks received
          </span>
          <button
            onClick={exportToCSV}
            disabled={chunkInfos.length === 0}
            className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <button
            onClick={onClearChunks}
            className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="border border-gray-200 rounded-md">
        <div 
          className="overflow-y-auto bg-gray-50"
          style={{ height: '400px' }}
        >
          {chunkInfos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-center">
                No chunk information yet.<br />
                Generate speech to see chunk details here.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {chunkInfos.map((chunk, index) => (
                <div
                  key={index}
                  className={`border rounded-md p-4 ${
                    chunk.validation?.isValid === false
                      ? 'border-red-300 bg-red-50'
                      : chunk.validation?.isValid === true
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      Chunk #{chunk.chunkNumber}
                      {chunk.validation?.isValid === false && (
                        <span className="text-red-600 text-xs">🗑️ DISCARDED</span>
                      )}
                      {chunk.validation?.isValid === true && (
                        <span className="text-green-600 text-xs">✅ VALID</span>
                      )}
                    </h3>
                    <div className="text-xs text-gray-500">
                      {new Date(chunk.timestamp).toLocaleTimeString(undefined, {
                        fractionalSecondDigits: 3
                      })}
                    </div>
                  </div>
                  
                  {/* Validation Information */}
                  {chunk.validation && (
                    <div className="mb-3 p-2 rounded border bg-gray-50">
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        Chunk Validation
                      </div>
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={chunk.validation.isValid ? 'text-green-600' : 'text-red-600'}>
                            {chunk.validation.isValid ? 'Valid' : 'Invalid'}
                          </span>
                        </div>
                        {chunk.validation.reason && (
                          <div>
                            <span className="font-medium">Reason:</span>{' '}
                            <span className="text-gray-600">{chunk.validation.reason}</span>
                          </div>
                        )}
                        {chunk.validation.chunkText && (
                          <div>
                            <span className="font-medium">Chunk Text:</span>{' '}
                            <span className="text-blue-600">"{chunk.validation.chunkText}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Audio Data:</span>{' '}
                      <span className="text-blue-600">
                        {chunk.audioDataLength ? `${chunk.audioDataLength} chars` : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Processing Time:</span>{' '}
                      <span className="text-green-600">
                        {chunk.processingTime ? `${chunk.processingTime.toFixed(1)}ms` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Parent Chunk:</span>{' '}
                      <span className="text-purple-600">
                        {chunk.parentChunkIndex !== undefined ? `#${chunk.parentChunkIndex + 1}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Additional Hume AI Response Fields */}
                  {chunk.rawData && (
                    <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
                      {chunk.rawData.generation_id && (
                        <div>
                          <span className="font-medium text-gray-600">Generation ID:</span>{' '}
                          <span className="text-indigo-600 font-mono">
                            {chunk.rawData.generation_id.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                      {chunk.rawData.snippet_id && (
                        <div>
                          <span className="font-medium text-gray-600">Snippet ID:</span>{' '}
                          <span className="text-indigo-600 font-mono">
                            {chunk.rawData.snippet_id.substring(0, 8)}...
                          </span>
                        </div>
                      )}
                      {chunk.rawData.chunk_index !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Chunk Index:</span>{' '}
                          <span className="text-orange-600">
                            {chunk.rawData.chunk_index}
                          </span>
                        </div>
                      )}
                      {chunk.rawData.is_last_chunk !== undefined && (
                        <div>
                          <span className="font-medium text-gray-600">Last Chunk:</span>{' '}
                          <span className={chunk.rawData.is_last_chunk ? 'text-green-600' : 'text-gray-500'}>
                            {chunk.rawData.is_last_chunk ? 'Yes' : 'No'}
                          </span>
                        </div>
                      )}
                      {chunk.rawData.utterance_index !== undefined && chunk.rawData.utterance_index !== null && (
                        <div>
                          <span className="font-medium text-gray-600">Utterance Index:</span>{' '}
                          <span className="text-teal-600">
                            {chunk.rawData.utterance_index}
                          </span>
                        </div>
                      )}
                      {chunk.rawData.audio_format && (
                        <div>
                          <span className="font-medium text-gray-600">Audio Format:</span>{' '}
                          <span className="text-cyan-600">
                            {chunk.rawData.audio_format}
                          </span>
                        </div>
                      )}
                      {chunk.rawData.transcribed_text && (
                        <div className="col-span-2">
                          <span className="font-medium text-gray-600">Transcribed Text:</span>{' '}
                          <span className="text-pink-600">
                            "{chunk.rawData.transcribed_text}"
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Raw Chunk Data (JSON)
                      </span>
                    </div>
                    <pre className="text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(chunk.rawData, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {chunkInfos.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Showing {chunkInfos.length} chunks (oldest to newest) • 
          Scroll up to see earlier chunks
        </div>
      )}
    </div>
  );
}