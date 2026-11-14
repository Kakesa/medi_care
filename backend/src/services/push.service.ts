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

export async function savePushSubscription(input: {
  organizationId: string;
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

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!keys()) return;
  const rows = await PushSubscription.find({ userId });
  await Promise.all(rows.map(async (row) => {
    try {
      await sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }, JSON.stringify(payload));
    } catch (error) {
      const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: row._id });
      else logger.warn({ msg: 'Notification push non délivrée', status });
    }
  }));
}
