'use client';
//import Sidebar from "@/components/layout/Sidebar";
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import SessionHeader from 'components/chat/SessionHeader';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { useState } from 'react';
// import { ChatPanel } from '../components/features/ChatPanel';

// app/page.tsx
export default function HomePage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      
      {/* LEFT COLUMN — SIDEBAR */}
      <Sidebar />
      <SessionHeader />
      
      {/* RIGHT COLUMN — CHAT WINDOW + INPUT */}
      <div className="flex flex-col flex-1 bg-white">
        <ChatWindow />
        <InputBar />
      </div>

    </div>
  );
}

