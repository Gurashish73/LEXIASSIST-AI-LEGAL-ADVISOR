// src/lib/pusher/server.ts
import Pusher from 'pusher';

// Use a global variable to prevent multiple instances during hot-reloads in dev
const globalForPusher = globalThis as unknown as { pusher: Pusher };

export const pusher = globalForPusher.pusher || new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

if (process.env.NODE_ENV !== 'production') globalForPusher.pusher = pusher;