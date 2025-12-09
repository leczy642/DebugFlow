import '../styles/globals.css';
import React from 'react';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-100">
        {children}
      </body>
    </html>
  );
}
