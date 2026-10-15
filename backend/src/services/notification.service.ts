import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { paginated, readPagination } from '../utils/pagination.js';
import type { AuthContext } from '../types/express.js';

function toDto(row: {
  id?: string;
  _id: { toString(): string };
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedId?: string | null;
  createdAt?: Date;
}) {
  return {
    id: row.id ?? row._id.toString(),
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    relatedId: row.relatedId || undefined,
    createdAt: row.createdAt,
  };
}

export async function notifyUser(input: {
  organizationId: string;
  userId?: { toString(): string } | string | null;
  title: string;
  message: string;
  relatedId?: string;
}) {
  const userId = input.userId ? String(input.userId) : '';
  if (!userId) return;
  await Notification.create({
    organizationId: input.organizationId,
    userId,
    type: 'appointment',
    title: input.title,
    message: input.message,
    read: false,
    relatedId: input.relatedId,
  });
}

export async function listNotifications(actor: AuthContext, organizationId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = readPagination(query);
  const filter = { organizationId, userId: actor.id };
  const [rows, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return paginated(rows.map((row) => toDto(row)), total, page, limit);
}

export async function unreadCount(actor: AuthContext, organizationId: string) {
  const count = await Notification.countDocuments({ organizationId, userId: actor.id, read: false });
  return { count };
}

export async function markNotificationRead(actor: AuthContext, organizationId: string, id: string) {
  const row = await Notification.findOneAndUpdate(
    { _id: id, organizationId, userId: actor.id },
    { read: true },
    { new: true }
  );
  if (!row) {
    throw new ApiError(404, 'Notification introuvable', 'NOT_FOUND');
  }
  return toDto(row);
}

export async function markAllNotificationsRead(actor: AuthContext, organizationId: string) {
  await Notification.updateMany({ organizationId, userId: actor.id, read: false }, { read: true });
  return { success: true };
}
