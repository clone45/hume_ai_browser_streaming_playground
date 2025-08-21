'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, MessageSquare, Zap } from 'lucide-react';

export function TabNavigation() {
  const pathname = usePathname();

  const tabs = [
    {
      id: 'evi',
      label: 'EVI WebSocket',
      href: '/evi',
      icon: MessageSquare,
      description: 'Interactive conversational AI'
    },
    {
      id: 'tts',
      label: 'TTS REST',
      href: '/tts',
      icon: Mic,
      description: 'Text-to-speech streaming'
    },
    {
      id: 'chunked',
      label: 'Chunked TTS',
      href: '/chunked',
      icon: Mic,
      description: 'Simulated LLM chunked output'
    },
    {
      id: 'interruption',
      label: 'Interruption Handling',
      href: '/interruption',
      icon: Zap,
      description: 'Test interruption scenarios'
    }
  ];

  return (
    <div className="mb-8">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || (pathname === '/' && tab.id === 'evi');
            const Icon = tab.icon;
            
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon
                  className={`mr-2 h-5 w-5 ${
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                <div className="flex flex-col">
                  <span>{tab.label}</span>
                  <span className="text-xs text-gray-400">{tab.description}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}