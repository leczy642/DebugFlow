'use client';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { Button } from '../ui/Button';

export function ChatPanel() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');

  const chat = useMutation({
    mutationFn: async (payload: { message: string }) => {
      const data = await api.post('/api/chat', payload);
      return data;
    },
    onSuccess(data) {
      setReply(data.reply ?? '');
    },
  });

  return (
    <section className="space-y-3">
      <textarea
        className="w-full rounded-md border p-3"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button onClick={() => chat.mutate({ message })} disabled={chat.isPending}>
          {chat.isPending ? 'Thinking…' : 'Ask'}
        </Button>
      </div>
      {reply && (
        <div className="rounded-md border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Assistant</h3>
          <p className="whitespace-pre-wrap text-sm leading-6">{reply}</p>
        </div>
      )}
    </section>
  );
}
