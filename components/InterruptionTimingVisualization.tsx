'use client';

import { Clock, Zap, CheckCircle, XCircle, User, Bot, Copy, FileText } from 'lucide-react';

export interface InterruptionEvent {
  id: string;
  type: 'text_batch_start' | 'chunk_valid' | 'chunk_discarded' | 'user_interrupt' | 'system_response';
  timestamp: number;
  parentChunk?: number;
  chunkIndex?: number;
  textPreview?: string;
  expectedText?: string;
  validationReason?: string;
  audioSize?: number;
}

interface InterruptionTimingVisualizationProps {
  events: InterruptionEvent[];
  className?: string;
}

export function InterruptionTimingVisualization({ events, className = '' }: InterruptionTimingVisualizationProps) {
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

  // Get unique parent chunks for color coding
  const getParentChunkColor = (parentChunk?: number): string => {
    if (parentChunk === undefined) return 'bg-gray-400';
    if (parentChunk === -1) return 'bg-purple-500'; // System responses
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
      'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'
    ];
    return colors[parentChunk % colors.length];
  };

  // Get event styling
  const getEventStyling = (event: InterruptionEvent) => {
    switch (event.type) {
      case 'text_batch_start':
        return { 
          color: 'border-blue-600 bg-blue-100',
          icon: <Zap className="w-4 h-4 text-blue-600" />,
          label: 'New Text Batch'
        };
      case 'chunk_valid':
        return { 
          color: 'border-green-600 bg-green-100',
          icon: <CheckCircle className="w-4 h-4 text-green-600" />,
          label: 'Valid Chunk'
        };
      case 'chunk_discarded':
        return { 
          color: 'border-red-600 bg-red-100',
          icon: <XCircle className="w-4 h-4 text-red-600" />,
          label: 'Discarded Chunk'
        };
      case 'user_interrupt':
        return { 
          color: 'border-orange-600 bg-orange-100',
          icon: <User className="w-4 h-4 text-orange-600" />,
          label: 'User Interrupt'
        };
      case 'system_response':
        return { 
          color: 'border-purple-600 bg-purple-100',
          icon: <Bot className="w-4 h-4 text-purple-600" />,
          label: 'System Response'
        };
      default:
        return { 
          color: 'border-gray-600 bg-gray-100',
          icon: <Clock className="w-4 h-4 text-gray-600" />,
          label: 'Unknown Event'
        };
    }
  };

  // Copy events as interruption-focused CSV
  const copyInterruptionCSV = async () => {
    try {
      const csvHeaders = 'time_ms,event_type,parent_chunk,chunk_idx,validation,text_preview,expected_preview,audio_size';
      const csvRows = events.map(event => {
        const relativeTime = (event.timestamp - minTime).toFixed(0);
        const eventType = event.type.toUpperCase();
        const parentChunk = event.parentChunk !== undefined ? event.parentChunk : '';
        const chunkIdx = event.chunkIndex !== undefined ? event.chunkIndex : '';
        const validation = event.type.includes('chunk') ? (event.type === 'chunk_valid' ? 'VALID' : 'DISCARDED') : '';
        const textPreview = event.textPreview ? `"${event.textPreview.substring(0, 20).replace(/"/g, '""')}"` : '';
        const expectedPreview = event.expectedText ? `"${event.expectedText.substring(0, 20).replace(/"/g, '""')}"` : '';
        const audioSize = event.audioSize || '';
        
        return `${relativeTime},${eventType},${parentChunk},${chunkIdx},${validation},${textPreview},${expectedPreview},${audioSize}`;
      });
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      await navigator.clipboard.writeText(csvContent);
      
      console.log('Interruption timeline copied to clipboard as CSV');
    } catch (error) {
      console.error('Failed to copy interruption CSV to clipboard:', error);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Interruption Timeline Analysis
        </h2>
        {events.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={copyInterruptionCSV}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md flex items-center gap-2 text-sm transition-colors"
              title="Copy interruption timeline as CSV"
            >
              <FileText className="w-4 h-4" />
              Copy Timeline CSV
            </button>
          </div>
        )}
      </div>
      
      {events.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No interruption data yet. Start generating speech and use interruptions to see the timeline analysis.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Timeline visualization */}
          <div className="relative h-24 bg-gray-100 rounded-lg p-4">
            <div className="absolute top-2 left-4 text-xs text-gray-600">Interruption Timeline</div>
            
            {/* Time markers */}
            <div className="absolute bottom-12 left-0 right-0 h-px bg-gray-300"></div>
            <div className="absolute bottom-10 left-0 text-xs text-gray-500">0ms</div>
            <div className="absolute bottom-10 right-0 text-xs text-gray-500">{timeRange.toFixed(0)}ms</div>
            
            {/* Parent chunk color bands */}
            {[...new Set(events.map(e => e.parentChunk).filter(p => p !== undefined))].map(parentChunk => {
              const chunkEvents = events.filter(e => e.parentChunk === parentChunk);
              if (chunkEvents.length === 0) return null;
              
              const startPos = getRelativePosition(Math.min(...chunkEvents.map(e => e.timestamp)));
              const endPos = getRelativePosition(Math.max(...chunkEvents.map(e => e.timestamp)));
              const width = Math.max(2, endPos - startPos);
              
              return (
                <div
                  key={`band-${parentChunk}`}
                  className={`absolute bottom-16 h-2 ${getParentChunkColor(parentChunk)} opacity-30`}
                  style={{ 
                    left: `${startPos}%`, 
                    width: `${width}%`
                  }}
                  title={`Text Batch ${parentChunk === -1 ? 'System Response' : parentChunk}`}
                ></div>
              );
            })}
            
            {/* Event markers */}
            {events.map((event, index) => {
              const position = getRelativePosition(event.timestamp);
              const styling = getEventStyling(event);
              
              return (
                <div
                  key={index}
                  className="absolute bottom-12 transform -translate-x-1/2"
                  style={{ left: `${position}%` }}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${
                      event.type === 'chunk_valid' ? 'bg-green-500' :
                      event.type === 'chunk_discarded' ? 'bg-red-500' :
                      event.type === 'user_interrupt' ? 'bg-orange-500' :
                      event.type === 'system_response' ? 'bg-purple-500' :
                      'bg-blue-500'
                    } border-2 border-white shadow-sm cursor-help`}
                    title={`${styling.label} at ${formatRelativeTime(event.timestamp)}${
                      event.textPreview ? `\nText: ${event.textPreview.substring(0, 30)}...` : ''
                    }${
                      event.validationReason ? `\nReason: ${event.validationReason}` : ''
                    }`}
                  ></div>
                  <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-px h-4 bg-gray-300"></div>
                </div>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Valid Chunk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <XCircle className="w-4 h-4 text-red-600" />
                <span>Discarded Chunk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <User className="w-4 h-4 text-orange-600" />
                <span>User Interrupt</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <Bot className="w-4 h-4 text-purple-600" />
                <span>System Response</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <Zap className="w-4 h-4 text-blue-600" />
                <span>Text Batch Start</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-gray-400 opacity-50"></div>
                <span>Text Batch Timespan</span>
              </div>
            </div>
          </div>
          
          {/* Event list with validation details */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            <h3 className="font-medium text-gray-700">Interruption Event Log:</h3>
            {events.map((event, index) => {
              const styling = getEventStyling(event);
              
              return (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${styling.color}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {styling.icon}
                    <span className="font-medium">{styling.label}</span>
                    <span className="text-sm text-gray-500">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                    {event.parentChunk !== undefined && (
                      <span className={`px-2 py-0.5 rounded-full text-xs text-white ${getParentChunkColor(event.parentChunk)}`}>
                        {event.parentChunk === -1 ? 'SYS' : `T${event.parentChunk}`}
                      </span>
                    )}
                  </div>
                  
                  {event.textPreview && (
                    <div className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">Text:</span> "{event.textPreview.substring(0, 40)}..."
                    </div>
                  )}
                  
                  {event.expectedText && event.expectedText !== event.textPreview && (
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Expected:</span> "{event.expectedText.substring(0, 40)}..."
                    </div>
                  )}
                  
                  {event.validationReason && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Reason:</span> {event.validationReason}
                    </div>
                  )}
                  
                  {event.audioSize && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Audio:</span> {event.audioSize} chars
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