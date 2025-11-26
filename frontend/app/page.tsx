'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ChatPanel } from '../components/features/ChatPanel';

export default function HomePage() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <main className="space-y-6">
        <h1 className="text-3xl font-bold">debugFlow</h1>
        <p className="text-gray-600">AI-powered debugging with RAG.</p>
        <ChatPanel />
      </main>
    </QueryClientProvider>
  );
}
