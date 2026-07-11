// src/lib/pusher/client.ts
import PusherClient from 'pusher-js';

// Only initialize if we are in the browser to prevent SSR errors
export const getPusherClient = () => {
  if (typeof window === 'undefined') return null;
  
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  });
};