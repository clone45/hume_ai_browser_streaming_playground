'use client';

import { Mic } from 'lucide-react';
import { TabNavigation } from './TabNavigation';

interface PlaygroundLayoutProps {
  children: React.ReactNode;
}

export function PlaygroundLayout({ children }: PlaygroundLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Mic className="w-10 h-10" />
            Hume AI TTS Streaming Playground
          </h1>
          <p className="text-gray-600">
            Perfect gapless audio streaming using Web Audio API
          </p>
        </div>
        
        {/* Tab Navigation */}
        <TabNavigation />
        
        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}