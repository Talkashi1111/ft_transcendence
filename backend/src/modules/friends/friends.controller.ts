import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from './friends.service.js';
import type { SendFriendRequestBody } from './friends.schema.js';

/**
 * Get current user's friends with online status
 */
export async function getFriendsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const friends = await getFriends(userId);
  return reply.send({ friends });
}

/**
 * Get pending friend requests (sent and received)
 */
export async function getFriendRequestsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const requests = await getFriendRequests(userId);
  return reply.send(requests);
}

/**
 * Send a friend request
 */
export async function sendFriendRequestHandler(
  request: FastifyRequest<{ Body: SendFriendRequestBody }>,
  reply: FastifyReply
): Promise<void> {
  const senderId = request.user.id;
  const { userId: receiverId } = request.body;

  try {
    const { friendshipId } = await sendFriendRequest(senderId, receiverId);
    return reply.status(201).send({
      message: 'Friend request sent',
      friendshipId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send friend request';
    return reply.status(400).send({ error: message });
  }
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const { id: friendshipId } = request.params;

  try {
    await acceptFriendRequest(friendshipId, userId);
    return reply.send({ message: 'Friend request accepted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept friend request';
    return reply.status(400).send({ error: message });
  }
}

/**
 * Decline a friend request
 */
export async function declineFriendRequestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const { id: friendshipId } = request.params;

  try {
    await declineFriendRequest(friendshipId, userId);
    return reply.send({ message: 'Friend request declined' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to decline friend request';
    return reply.status(400).send({ error: message });
  }
}

/**
 * Remove a friend
 */
export async function removeFriendHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const currentUserId = request.user.id;
  const { id: friendUserId } = request.params;

  try {
    await removeFriend(friendUserId, currentUserId);
    return reply.send({ message: 'Friend removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove friend';
    return reply.status(400).send({ error: message });
  }
}

/**
 * Cancel a sent friend request
 */
export async function cancelFriendRequestHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;
  const { id: friendshipId } = request.params;

  try {
    await cancelFriendRequest(friendshipId, userId);
    return reply.send({ message: 'Friend request cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel friend request';
    return reply.status(400).send({ error: message });
  }
}
