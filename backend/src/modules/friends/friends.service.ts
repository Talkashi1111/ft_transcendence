import { prisma } from '../../utils/prisma.js';
import { FriendshipStatus, NotificationType } from '../../generated/prisma/client.js';
import { isUserOnline, sendToUser } from '../game/game.gateway.js';
import type { Friend, FriendRequest } from './friends.schema.js';

/**
 * Get all accepted friends for a user with online status
 */
export async function getFriends(userId: string): Promise<Friend[]> {
  // Get friendships where user is sender and status is ACCEPTED
  const sentFriendships = await prisma.friendship.findMany({
    where: { userId, status: FriendshipStatus.ACCEPTED },
    include: { friend: { select: { id: true, alias: true, lastSeenAt: true } } },
  });

  // Get friendships where user is receiver and status is ACCEPTED
  const receivedFriendships = await prisma.friendship.findMany({
    where: { friendId: userId, status: FriendshipStatus.ACCEPTED },
    include: { user: { select: { id: true, alias: true, lastSeenAt: true } } },
  });

  // Combine and format
  const friends: Friend[] = [];

  for (const f of sentFriendships) {
    friends.push({
      id: f.friend.id,
      alias: f.friend.alias,
      isOnline: isUserOnline(f.friend.id),
      lastSeenAt: f.friend.lastSeenAt?.toISOString() ?? null,
    });
  }

  for (const f of receivedFriendships) {
    friends.push({
      id: f.user.id,
      alias: f.user.alias,
      isOnline: isUserOnline(f.user.id),
      lastSeenAt: f.user.lastSeenAt?.toISOString() ?? null,
    });
  }

  // Sort: online first, then by alias
  friends.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.alias.localeCompare(b.alias);
  });

  return friends;
}

/**
 * Get pending friend requests (sent and received)
 */
export async function getFriendRequests(
  userId: string
): Promise<{ received: FriendRequest[]; sent: FriendRequest[] }> {
  // Received requests (where user is the friend/receiver)
  const receivedFriendships = await prisma.friendship.findMany({
    where: { friendId: userId, status: FriendshipStatus.PENDING },
    include: { user: { select: { id: true, alias: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Sent requests (where user is the sender)
  const sentFriendships = await prisma.friendship.findMany({
    where: { userId, status: FriendshipStatus.PENDING },
    include: { friend: { select: { id: true, alias: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const received: FriendRequest[] = receivedFriendships.map((f) => ({
    id: f.id,
    userId: f.user.id,
    alias: f.user.alias,
    createdAt: f.createdAt.toISOString(),
  }));

  const sent: FriendRequest[] = sentFriendships.map((f) => ({
    id: f.id,
    userId: f.friend.id,
    alias: f.friend.alias,
    createdAt: f.createdAt.toISOString(),
  }));

  return { received, sent };
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(
  senderId: string,
  receiverId: string
): Promise<{ friendshipId: string }> {
  // Check if receiver exists
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, alias: true },
  });

  if (!receiver) {
    throw new Error('User not found');
  }

  // Check if sender is trying to friend themselves
  if (senderId === receiverId) {
    throw new Error('You cannot send a friend request to yourself');
  }

  // Check if a friendship already exists (in either direction)
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId },
      ],
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
      throw new Error('You are already friends with this user');
    } else if (existingFriendship.status === FriendshipStatus.PENDING) {
      if (existingFriendship.userId === senderId) {
        throw new Error('You already sent a friend request to this user');
      } else {
        throw new Error('This user already sent you a friend request');
      }
    } else if (existingFriendship.status === FriendshipStatus.BLOCKED) {
      throw new Error('Cannot send friend request');
    }
  }

  // Create the friendship
  const friendship = await prisma.friendship.create({
    data: {
      userId: senderId,
      friendId: receiverId,
      status: FriendshipStatus.PENDING,
    },
  });

  // Get sender info for notification
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { alias: true },
  });

  // Create notification for receiver
  await prisma.notification.create({
    data: {
      userId: receiverId,
      type: NotificationType.FRIEND_REQUEST,
      data: JSON.stringify({ fromUserId: senderId, fromAlias: sender?.alias }),
    },
  });

  // Notify receiver in real-time via WebSocket
  sendToUser(receiverId, 'notification:new', {
    type: NotificationType.FRIEND_REQUEST,
    fromUserId: senderId,
    fromAlias: sender?.alias,
  });

  return { friendshipId: friendship.id };
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId: string, userId: string): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: {
      user: { select: { id: true, alias: true } },
      friend: { select: { id: true, alias: true } },
    },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only the receiver can accept
  if (friendship.friendId !== userId) {
    throw new Error('You cannot accept this friend request');
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error('This friend request is no longer pending');
  }

  // Update friendship status
  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: FriendshipStatus.ACCEPTED },
  });

  // Get accepter info for notification
  const accepter = await prisma.user.findUnique({
    where: { id: userId },
    select: { alias: true },
  });

  // Create notification for the original sender
  await prisma.notification.create({
    data: {
      userId: friendship.userId,
      type: NotificationType.FRIEND_ACCEPTED,
      data: JSON.stringify({ fromUserId: userId, fromAlias: accepter?.alias }),
    },
  });

  // Notify original sender in real-time via WebSocket
  sendToUser(friendship.userId, 'notification:new', {
    type: NotificationType.FRIEND_ACCEPTED,
    fromUserId: userId,
    fromAlias: accepter?.alias,
  });

  // Also send a friend:accepted event so they can update their UI immediately
  sendToUser(friendship.userId, 'friend:accepted', {
    friendId: userId,
    friendAlias: accepter?.alias,
  });
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId: string, userId: string): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only the receiver can decline
  if (friendship.friendId !== userId) {
    throw new Error('You cannot decline this friend request');
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error('This friend request is no longer pending');
  }

  // Delete the friendship record
  await prisma.friendship.delete({
    where: { id: friendshipId },
  });
}

/**
 * Remove a friend (unfriend)
 */
export async function removeFriend(friendshipUserId: string, currentUserId: string): Promise<void> {
  // Find the friendship in either direction
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: currentUserId, friendId: friendshipUserId },
        { userId: friendshipUserId, friendId: currentUserId },
      ],
      status: FriendshipStatus.ACCEPTED,
    },
  });

  if (!friendship) {
    throw new Error('Friendship not found');
  }

  // Delete the friendship
  await prisma.friendship.delete({
    where: { id: friendship.id },
  });
}

/**
 * Cancel a sent friend request
 */
export async function cancelFriendRequest(friendshipId: string, userId: string): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only the sender can cancel
  if (friendship.userId !== userId) {
    throw new Error('You cannot cancel this friend request');
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error('This friend request is no longer pending');
  }

  // Delete the friendship record
  await prisma.friendship.delete({
    where: { id: friendshipId },
  });
}
