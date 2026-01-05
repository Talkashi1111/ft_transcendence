import { Type, Static } from '@sinclair/typebox';

// Friend info with online status
export const friendSchema = Type.Object({
  id: Type.String(),
  alias: Type.String(),
  isOnline: Type.Boolean(),
  lastSeenAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});
export type Friend = Static<typeof friendSchema>;

// Friend request
export const friendRequestSchema = Type.Object({
  id: Type.String(), // Friendship ID
  userId: Type.String(),
  alias: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});
export type FriendRequest = Static<typeof friendRequestSchema>;

// === Request Bodies ===

export const sendFriendRequestBodySchema = Type.Object({
  userId: Type.String({ description: 'The ID of the user to send a friend request to' }),
});
export type SendFriendRequestBody = Static<typeof sendFriendRequestBodySchema>;

// === Response Schemas ===

export const friendsListResponseSchema = Type.Object({
  friends: Type.Array(friendSchema),
});

export const friendRequestsResponseSchema = Type.Object({
  received: Type.Array(friendRequestSchema),
  sent: Type.Array(friendRequestSchema),
});

export const friendRequestResponseSchema = Type.Object({
  message: Type.String(),
  friendshipId: Type.String(),
});

export const acceptDeclineResponseSchema = Type.Object({
  message: Type.String(),
});

export const removeFriendResponseSchema = Type.Object({
  message: Type.String(),
});

// === JSON Schemas for Fastify ===

export const friendsListResponseJsonSchema = {
  type: 'object',
  properties: {
    friends: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          alias: { type: 'string' },
          isOnline: { type: 'boolean' },
          lastSeenAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
    },
  },
};

export const friendRequestsResponseJsonSchema = {
  type: 'object',
  properties: {
    received: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          alias: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    sent: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          alias: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export const sendFriendRequestBodyJsonSchema = {
  type: 'object',
  required: ['userId'],
  properties: {
    userId: { type: 'string' },
  },
};

export const friendRequestResponseJsonSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    friendshipId: { type: 'string' },
  },
};

export const acceptDeclineResponseJsonSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
};

export const removeFriendResponseJsonSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
};

export const errorResponseJsonSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};
