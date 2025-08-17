'use client';

import { Clock, Send, Volume2, Copy, FileText } from 'lucide-react';

export interface ChunkEvent {
  id: string;
  type: 'chunk_sent' | 'audio_received';
  timestamp: number;
  chunkIndex?: number;
  chunkText?: string;
  audioLength?: number;
}

interface ChunkTimingVisualizationProps {
  events: ChunkEvent[];
  className?: string;
}

export function ChunkTimingVisualization({ events, className = '' }: ChunkTimingVisualizationProps) {
  // Get the time range for visualization with padding
  const timestamps = events.map(e => e.timestamp);
  const rawMinTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const rawMaxTime = timestamps.length > 0 ? Math.max(...timestamps) : 1000;
  const rawTimeRange = Math.max(rawMaxTime - rawMinTime, 1000);
  
  // Add 10% padding on each side
  const padding = rawTimeRange * 0.1;
  const minTime = rawMinTime - padding;
  const maxTime = rawMaxTime + padding;
  const timeRange = maxTime - minTime;

  // Calculate relative positions (0-100%)
  const getRelativePosition = (timestamp: number): number => {
    return ((timestamp - minTime) / timeRange) * 100;
  };

  // Format time relative to start
  const formatRelativeTime = (timestamp: number): string => {
    const relativeMs = timestamp - minTime;
    return `+${relativeMs.toFixed(0)}ms`;
  };

  // Calculate time to first audio for each chunk
  const getTimeToFirstAudio = () => {
    const chunks = new Map<number, { sentTime: number, firstAudioTime?: number }>();
    
    // Find send times and first audio receive times for each chunk
    events.forEach(event => {
      if (event.chunkIndex === undefined) return;
      
      if (event.type === 'chunk_sent') {
        chunks.set(event.chunkIndex, { 
          sentTime: event.timestamp,
          firstAudioTime: chunks.get(event.chunkIndex)?.firstAudioTime 
        });
      } else if (event.type === 'audio_received') {
        const existing = chunks.get(event.chunkIndex);
        if (existing && !existing.firstAudioTime) {
          existing.firstAudioTime = event.timestamp;
        }
      }
    });

    // Calculate latencies
    const latencies: Array<{ chunkIndex: number, latencyMs: number, sentTime: number, firstAudioTime: number }> = [];
    chunks.forEach((data, chunkIndex) => {
      if (data.firstAudioTime) {
        latencies.push({
          chunkIndex,
          latencyMs: data.firstAudioTime - data.sentTime,
          sentTime: data.sentTime,
          firstAudioTime: data.firstAudioTime
        });
      }
    });

    return latencies;
  };

  // Copy events as JSON to clipboard
  const copyEventsToClipboard = async () => {
    try {
      const eventData = {
        metadata: {
          totalEvents: events.length,
          timeRangeMs: timeRange,
          startTime: minTime,
          endTime: maxTime,
          exportedAt: new Date().toISOString()
        },
        events: events.map(event => ({
          ...event,
          relativeTimestamp: event.timestamp - minTime,
          formattedTime: formatRelativeTime(event.timestamp)
        }))
      };
      
      const jsonString = JSON.stringify(eventData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      console.log('Event log copied to clipboard as JSON');
    } catch (error) {
      console.error('Failed to copy events to clipboard:', error);
    }
  };

  // Copy events as compact CSV to clipboard
  const copyEventsAsCSV = async () => {
    try {
      const csvHeaders = 'time_ms,type,chunk,text_preview,audio_size';
      const csvRows = events.map(event => {
        const relativeTime = event.timestamp - minTime;
        const type = event.type === 'chunk_sent' ? 'SENT' : 'RECV';
        const chunkNum = event.chunkIndex !== undefined ? event.chunkIndex : '';
        const textPreview = event.chunkText ? `"${event.chunkText.substring(0, 30).replace(/"/g, '""')}..."` : '';
        const audioSize = event.audioLength || '';
        
        return `${relativeTime},${type},${chunkNum},${textPreview},${audioSize}`;
      });
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      await navigator.clipboard.writeText(csvContent);
      
      console.log('Event log copied to clipboard as CSV');
    } catch (error) {
      console.error('Failed to copy CSV to clipboard:', error);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Chunk Timing Analysis
        </h2>
        {events.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={copyEventsAsCSV}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md flex items-center gap-2 text-sm transition-colors"
              title="Copy compact CSV for troubleshooting"
            >
              <FileText className="w-4 h-4" />
              Copy CSV
            </button>
            <button
              onClick={copyEventsToClipboard}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-2 text-sm transition-colors"
              title="Copy full event log as JSON"
            >
              <Copy className="w-4 h-4" />
              Copy JSON
            </button>
          </div>
        )}
      </div>
      
      {events.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No timing data yet. Start sending chunks to see the timing visualization.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Timeline visualization */}
          <div className="relative h-20 bg-gray-100 rounded-lg p-4">
            <div className="absolute top-2 left-4 text-xs text-gray-600">Timeline</div>
            
            {/* Time markers */}
            <div className="absolute bottom-8 left-0 right-0 h-px bg-gray-300"></div>
            <div className="absolute bottom-6 left-0 text-xs text-gray-500">0ms</div>
            <div className="absolute bottom-6 right-0 text-xs text-gray-500">{timeRange.toFixed(0)}ms</div>
            
            {/* Event markers */}
            {events.map((event, index) => {
              const position = getRelativePosition(event.timestamp);
              const isSent = event.type === 'chunk_sent';
              
              return (
                <div
                  key={index}
                  className="absolute bottom-8 transform -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isSent ? 'bg-blue-500' : 'bg-green-500'
                    } border-2 border-white shadow-sm`}
                    title={`${event.type} at ${formatRelativeTime(event.timestamp)}`}
                  ></div>
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-px h-4 bg-gray-300"></div>
                </div>
              );
            })}
            
            {/* Time to first audio indicators */}
            {getTimeToFirstAudio().map((latency, index) => {
              const sendPosition = getRelativePosition(latency.sentTime);
              const receivePosition = getRelativePosition(latency.firstAudioTime);
              const latencyWidth = Math.max(1, receivePosition - sendPosition);
              
              return (
                <div key={`latency-${index}`}>
                  {/* Latency arc/line */}
                  <div
                    className="absolute bottom-12 h-1 bg-purple-400 opacity-70"
                    style={{ 
                      left: `${sendPosition}%`, 
                      width: `${latencyWidth}%`,
                      height: '2px'
                    }}
                  ></div>
                  
                  {/* Latency label */}
                  <div
                    className="absolute bottom-14 transform -translate-x-1/2 text-xs text-purple-600 font-medium"
                    style={{ left: `${sendPosition + latencyWidth / 2}%` }}
                  >
                    {latency.latencyMs.toFixed(0)}ms
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <Send className="w-4 h-4 text-blue-600" />
              <span>Chunk Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <Volume2 className="w-4 h-4 text-green-600" />
              <span>Audio Received</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-purple-400"></div>
              <span>Time to First Audio</span>
            </div>
          </div>
          
          {/* Event list */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            <h3 className="font-medium text-gray-700">Event Log:</h3>
            {events.map((event, index) => {
              const isSent = event.type === 'chunk_sent';
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    isSent ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isSent ? (
                      <Send className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-green-600" />
                    )}
                    <span className="font-medium">
                      {isSent ? 'Sent Chunk' : 'Received Audio'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                  
                  {isSent && event.chunkText && (
                    <div className="text-sm text-gray-700">
                      Chunk #{event.chunkIndex! + 1}: "{event.chunkText.substring(0, 50)}..."
                    </div>
                  )}
                  
                  {!isSent && event.audioLength && (
                    <div className="text-sm text-gray-700">
                      Audio data: {event.audioLength} characters
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}