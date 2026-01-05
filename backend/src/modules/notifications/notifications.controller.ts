import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupUserNotifications,
} from './notifications.service.js';

/**
 * Get user's notifications
 */
export async function getNotificationsHandler(
  request: FastifyRequest<{ Querystring: { unreadOnly?: string; limit?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const unreadOnly = request.query.unreadOnly === 'true';
  const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

  const notifications = await getNotifications(userId, { unreadOnly, limit });
  const unreadCount = await getUnreadCount(userId);

  return reply.send({ notifications, unreadCount });
}

/**
 * Get unread notification count
 */
export async function getUnreadCountHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const count = await getUnreadCount(userId);
  return reply.send({ count });
}

/**
 * Mark specific notifications as read
 */
export async function markAsReadHandler(
  request: FastifyRequest<{ Body: { notificationIds: string[] } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const { notificationIds } = request.body;

  const count = await markAsRead(userId, notificationIds);

  // Cleanup old read notifications to prevent endless growth
  await cleanupUserNotifications(userId);

  return reply.send({ message: `Marked ${count} notifications as read`, count });
}

/**
 * Mark all notifications as read
 */
export async function markAllAsReadHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const count = await markAllAsRead(userId);

  // Cleanup old read notifications to prevent endless growth
  await cleanupUserNotifications(userId);

  return reply.send({ message: `Marked ${count} notifications as read`, count });
}

/**
 * Delete a notification
 */
export async function deleteNotificationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const { id } = request.params;

  const deleted = await deleteNotification(userId, id);

  if (!deleted) {
    return reply.status(404).send({ error: 'Notification not found' });
  }

  return reply.send({ message: 'Notification deleted' });
}
