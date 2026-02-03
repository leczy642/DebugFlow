import '../styles/globals.css';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DebugFlow',
  description: 'Advanced Agentic Coding & Debugging Platform',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-100">
        {children}
      </body>
    </html>
  );
}
