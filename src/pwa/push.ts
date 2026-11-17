import { httpClient } from '@/services/httpClient';

function keyToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function enablePush() {
  if (!pushSupported()) return 'unsupported' as const;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied' as const;
  const { publicKey } = await httpClient.get<{ publicKey: string }>('/push/key');
  if (!publicKey) return 'unconfigured' as const;
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyToBytes(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'unsupported' as const;
  await httpClient.post('/push/subscribe', { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
  return 'enabled' as const;
}

export async function disablePush() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await httpClient.post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  }
}
