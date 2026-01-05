import { prisma } from '../../utils/prisma.js';

export interface NotificationData {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<NotificationData[]> {
  const { unreadOnly = false, limit = 50 } = options;

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly && { read: false }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return notifications.map((n) => {
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(n.data) as Record<string, unknown>;
    } catch (e) {
      console.error(`[Notifications] Failed to parse data for ${n.id}:`, n.data, e);
    }
    return {
      id: n.id,
      type: n.type,
      data: parsedData,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  });
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Mark specific notifications as read
 */
export async function markAsRead(userId: string, notificationIds: string[]): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId, // Ensure user owns these notifications
    },
    data: { read: true },
  });

  return result.count;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

/**
 * Delete a notification
 */
export async function deleteNotification(userId: string, notificationId: string): Promise<boolean> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return false;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return true;
}

/**
 * Clean up old notifications to prevent endless growth
 * Deletes read notifications older than 30 days
 */
export async function cleanupOldNotifications(): Promise<{ deletedCount: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Delete read notifications older than 30 days
  const result = await prisma.notification.deleteMany({
    where: {
      read: true,
      createdAt: { lt: thirtyDaysAgo },
    },
  });

  return { deletedCount: result.count };
}

/**
 * Clean up notifications for a specific user
 * Called after marking notifications as read to prevent accumulation
 */
export async function cleanupUserNotifications(userId: string): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Delete read notifications older than 7 days for this user
  await prisma.notification.deleteMany({
    where: {
      userId,
      read: true,
      createdAt: { lt: sevenDaysAgo },
    },
  });
}
