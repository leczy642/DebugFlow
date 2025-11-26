'use client';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Button } from '../ui/Button';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export function ChatPanel() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');

  const chat = useMutation({
    mutationFn: async (payload: { message: string }) => {
      const res = await axios.post(`${BASE_URL}/api/chat`, payload);
      return res.data;
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
