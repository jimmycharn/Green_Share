import { supabase } from '@/lib/supabase';

let activeChannels: Map<string, any> = new Map();

export function subscribeToTable(
  channelName: string,
  table: string,
  filter: string | null,
  onChange: () => void
) {
  // Unsubscribe existing channel with same name
  const existing = activeChannels.get(channelName);
  if (existing) {
    supabase.removeChannel(existing);
    activeChannels.delete(channelName);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: filter || undefined,
      },
      (payload) => {
        console.log(`[Realtime] ${table} change:`, payload.eventType, payload);
        onChange();
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Channel error: ${channelName}`);
      } else if (status === 'TIMED_OUT') {
        console.warn(`[Realtime] Channel timed out: ${channelName}`);
      }
    });

  activeChannels.set(channelName, channel);
  return channel;
}

export function unsubscribeChannel(channelName: string) {
  const channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }
}

export function unsubscribeAll() {
  activeChannels.forEach((channel) => {
    supabase.removeChannel(channel);
  });
  activeChannels.clear();
}
