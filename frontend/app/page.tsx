'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import InputBar from '../components/chat/InputBar';
import SessionHeader from 'components/chat/SessionHeader';
import { useAuth } from '@/lib/hooks/useAuth';

// app/page.tsx
export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render content (will redirect)
  if (!isAuthenticated) {
    return null;
  }

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

