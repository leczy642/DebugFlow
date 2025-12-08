import '../styles/globals.css';
import React from 'react';

export const metadata = {
  title: 'debugFlow',
  description: 'AI-powered debugging with RAG',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-100">
        <div className="mx-auto max-w-6xl p-6">
          {children}
        </div>
      </body>
    </html>
  );
}
