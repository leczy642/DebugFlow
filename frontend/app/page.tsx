'use client';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { useState } from 'react';
// import { ChatPanel } from '../components/features/ChatPanel';

// app/page.tsx
export default function HomePage() {
  return (
    <div className="flex flex-col h-full w-full">
       <ChatWindow />
      <InputBar />
    </div>
  );
}
