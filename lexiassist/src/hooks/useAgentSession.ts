'use client';

import { useEffect, useState } from 'react';

import { getPusherClient } from '@/lib/pusher/client';
import type {
  AgentCompletedEvent,
  AgentProgressEvent,
} from '@/lib/schemas/frontend/frontend-contract';

type AgentStatus =
  | 'IDLE'
  | 'INITIALIZING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export function useAgentSession(sessionId: string | null) {
  const [status, setStatus] = useState<AgentStatus>('IDLE');
  const [currentStepText, setCurrentStepText] = useState('');
  const [finalResponse, setFinalResponse] =
    useState<AgentCompletedEvent | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus('IDLE');
      setCurrentStepText('');
      setFinalResponse(null);
      return;
    }

    const pusher = getPusherClient();
    if (!pusher) return;

    setStatus('INITIALIZING');
    setCurrentStepText('Connecting to legal agent...');
    setFinalResponse(null);

    const channelName = `session-${sessionId}`;
    const channel = pusher.subscribe(channelName);

    const handleSubscribed = () => {
      setStatus('PROCESSING');
      setCurrentStepText('Legal agent is analyzing your case...');
    };

    const handleProgress = (data: AgentProgressEvent) => {
      setCurrentStepText(data.step);
    };

    const handleCompleted = (data: AgentCompletedEvent) => {
      setStatus('COMPLETED');
      setCurrentStepText('Analysis complete.');
      setFinalResponse(data);
    };

    const handleSubscriptionError = (error: unknown) => {
      console.error('Pusher subscription error:', error);
      setStatus('FAILED');
      setCurrentStepText('Unable to receive realtime updates.');
    };

    const handleConnectionError = (error: unknown) => {
      console.error('Pusher connection error:', error);
    };

    channel.bind('pusher:subscription_succeeded', handleSubscribed);
    channel.bind('pusher:subscription_error', handleSubscriptionError);

    channel.bind('agent:progress', handleProgress);
    channel.bind('agent:completed', handleCompleted);

    pusher.connection.bind('error', handleConnectionError);

    return () => {
      channel.unbind('pusher:subscription_succeeded', handleSubscribed);
      channel.unbind('pusher:subscription_error', handleSubscriptionError);

      channel.unbind('agent:progress', handleProgress);
      channel.unbind('agent:completed', handleCompleted);

      pusher.connection.unbind('error', handleConnectionError);

      pusher.unsubscribe(channelName);
    };
  }, [sessionId]);

  return {
    status,
    currentStepText,
    finalResponse,
  };
}