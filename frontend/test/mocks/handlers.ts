import { http, HttpResponse } from 'msw';

export const handlers = [
  // User endpoints
  http.get('/api/users/me', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      alias: 'test_user',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  }),

  // Game match endpoints
  http.post('/api/game/match', async ({ request }) => {
    const body = await request.json();

    // This is the check that would have caught the bug!
    if (!body || typeof body !== 'object' || !('mode' in body)) {
      return HttpResponse.json({ message: 'Mode is required' }, { status: 400 });
    }

    return HttpResponse.json({
      matchId: 'test-match-id',
      mode: body.mode,
      creatorAlias: 'test_user',
      websocketUrl: '/ws/game/test-match-id',
    });
  }),

  http.post('/api/game/match/:matchId/join', ({ params }) => {
    return HttpResponse.json({
      matchId: params.matchId,
      mode: '1v1',
      creatorAlias: 'creator_user',
      joinerAlias: 'test_user',
      websocketUrl: `/ws/game/${params.matchId}`,
    });
  }),

  http.post('/api/game/quickmatch', () => {
    return HttpResponse.json({
      matchId: 'quickmatch-id',
      mode: '1v1',
      playerAlias: 'test_user',
      opponentAlias: 'opponent_user',
      websocketUrl: '/ws/game/quickmatch-id',
    });
  }),

  http.delete('/api/game/match/current', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/game/matches', () => {
    // Backend returns { matches: [...] }, not just the array
    return HttpResponse.json({
      matches: [
        {
          id: 'available-match-1',
          mode: '1v1',
          status: 'waiting',
          player1: { id: 'creator-id', username: 'creator_user' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),
];
