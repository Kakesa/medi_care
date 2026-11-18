import { sendNotification, setVapidDetails } from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';
import { logger } from '../utils/logger.js';

let configured = false;

function keys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  if (!publicKey || !privateKey) return null;
  if (!configured) {
    setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@medicare.local', publicKey, privateKey);
    configured = true;
  }
  return { publicKey, privateKey };
}

export function pushPublicKey() {
  return keys()?.publicKey ?? '';
}

export function publicNotice(payload: { title: string; body: string; url?: string }) {
  const url = payload.url && payload.url.startsWith('/') && !payload.url.startsWith('//')
    ? payload.url.slice(0, 200)
    : '/dashboard';
  return {
    title: payload.title.replace(/\s+/g, ' ').trim().slice(0, 80) || 'HopeCare',
    body: payload.body.replace(/\s+/g, ' ').trim().slice(0, 140) || 'Ouvrez HopeCare pour voir le détail.',
    url,
  };
}

export async function savePushSubscription(input: {
  organizationId: string | null;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: input.endpoint },
    { organizationId: input.organizationId, userId: input.userId, p256dh: input.p256dh, auth: input.auth },
    { upsert: true, new: true },
  );
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await PushSubscription.deleteOne({ userId, endpoint });
}

export async function removeAllPushSubscriptions(userId: string) {
  await PushSubscription.deleteMany({ userId });
}

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!keys()) return;
  const rows = await PushSubscription.find({ userId });
  const notice = publicNotice(payload);
  await Promise.all(rows.map(async (row) => {
    try {
      await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, JSON.stringify(notice));
    } catch (error) {
      const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: row._id });
      else logger.warn({ msg: 'Notification push non délivrée', status });
    }
  }));
}
