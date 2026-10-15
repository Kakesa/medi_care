import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as notificationService from '../services/notification.service.js';

const org = (req: Request) => req.organizationId!;
const auth = (req: Request) => req.auth!;

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.listNotifications(auth(req), org(req), req.query as never));
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.unreadCount(auth(req), org(req)));
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.markNotificationRead(auth(req), org(req), req.params.id));
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await notificationService.markAllNotificationsRead(auth(req), org(req)));
});
