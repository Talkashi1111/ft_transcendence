import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import * as auth from '../src/utils/auth';

// Mock dependencies that rely on canvas - must be before imports that use them
vi.mock('../src/game/pong', () => ({
  PongGame: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../src/game/remote-pong', () => ({
  RemotePongGame: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    getCurrentState: vi.fn(() => ({
      player1: { alias: 'test_player1' },
      player2: { alias: 'test_player2' },
      player1Score: 5,
      player2Score: 3,
    })),
  })),
}));

vi.mock('../src/game/tournament', () => ({
  TournamentManager: vi.fn().mockImplementation(() => ({
    addPlayer: vi.fn(),
    getPlayerCount: vi.fn(() => 0),
    start: vi.fn(),
  })),
}));

vi.mock('../src/utils/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../src/utils/modal', () => ({
  showConfirmModal: vi.fn(),
}));

vi.mock('../src/utils/websocket', () => ({
  resetWebSocketManager: vi.fn(),
}));

// Import after mocks are set up
import { renderPlayPage } from '../src/pages/play';

describe('Play Page', () => {
  let container: HTMLElement;
  let mockRenderNavBar: ReturnType<typeof vi.fn>;
  let mockSetupNavigation: ReturnType<typeof vi.fn>;

  // Suppress unhandled promise rejections at process level for these tests
  // (RemotePongGame canvas errors are expected in jsdom)
  beforeAll(() => {
    process.on('unhandledRejection', () => {
      // Silently handle - these are expected canvas initialization errors
    });
  });

  beforeEach(async () => {
    // Create a fresh DOM element for each test
    container = document.createElement('div');
    container.id = 'container';
    document.body.appendChild(container);

    mockRenderNavBar = vi.fn().mockResolvedValue('<nav>Mock NavBar</nav>');
    mockSetupNavigation = vi.fn();

    // Mock authentication to enable remote buttons
    vi.spyOn(auth, 'isAuthenticated').mockResolvedValue(true);

    // Render the play page
    await renderPlayPage(container, mockRenderNavBar, mockSetupNavigation);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('Create Match - Body Parameter Validation', () => {
    it('should send mode in request body when creating a match', async () => {
      // This test would have caught the bug!
      let receivedBody: { mode?: string } | null = null;

      // Override the MSW handler to capture the request body
      server.use(
        http.post('/api/game/match', async ({ request }) => {
          receivedBody = (await request.json()) as { mode?: string };

          if (!receivedBody || !receivedBody.mode) {
            return HttpResponse.json({ message: 'Mode is required' }, { status: 400 });
          }

          return HttpResponse.json({
            matchId: 'test-match-id',
            mode: receivedBody.mode,
            creatorAlias: 'test_user',
            websocketUrl: '/ws/game/test-match-id',
          });
        })
      );

      const createBtn = container.querySelector('#remote-create-btn') as HTMLButtonElement;
      expect(createBtn).toBeTruthy();

      // Click the create match button
      createBtn.click();

      // Wait for the fetch to complete
      await vi.waitFor(
        () => {
          expect(receivedBody).not.toBeNull();
        },
        { timeout: 1000 }
      );

      // Assert that the body contains the mode field
      expect(receivedBody).toEqual({ mode: '1v1' });

      // Give time for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should include Content-Type header when sending body', async () => {
      let requestHeaders: Headers | null = null;

      server.use(
        http.post('/api/game/match', async ({ request }) => {
          requestHeaders = request.headers;
          const body = (await request.json()) as { mode?: string };

          return HttpResponse.json({
            matchId: 'test-match-id',
            mode: body.mode,
            creatorAlias: 'test_user',
            websocketUrl: '/ws/game/test-match-id',
          });
        })
      );

      const createBtn = container.querySelector('#remote-create-btn') as HTMLButtonElement;
      createBtn.click();

      await vi.waitFor(() => {
        expect(requestHeaders).not.toBeNull();
      });

      expect(requestHeaders!.get('content-type')).toBe('application/json');
    });
  });

  describe('Quick Match', () => {
    it('should call quickmatch endpoint without body', async () => {
      let receivedBody: unknown = 'NOT_SET';

      server.use(
        http.post('/api/game/quickmatch', async ({ request }) => {
          // Try to read body - it should be empty
          const text = await request.text();
          receivedBody = text || null;

          return HttpResponse.json({
            matchId: 'quickmatch-id',
            mode: '1v1',
            playerAlias: 'test_user',
            opponentAlias: 'opponent_user',
            websocketUrl: '/ws/game/quickmatch-id',
          });
        })
      );

      const quickmatchBtn = container.querySelector('#remote-quickmatch-btn') as HTMLButtonElement;
      expect(quickmatchBtn).toBeTruthy();

      quickmatchBtn.click();

      await vi.waitFor(
        () => {
          expect(receivedBody).not.toBe('NOT_SET');
        },
        { timeout: 1000 }
      );

      // Quickmatch should not send a body
      expect(receivedBody).toBeNull();

      // Give time for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('Join Match', () => {
    it('should fetch and display available matches', async () => {
      // Click join button to show join screen
      const joinBtn = container.querySelector('#remote-join-btn') as HTMLButtonElement;
      joinBtn.click();

      // Wait for available matches to load
      await vi.waitFor(() => {
        const matchList = container.querySelector('#available-matches-list');
        expect(matchList?.innerHTML).toContain('creator_user');
      });

      // Should display the match from the handler
      const matchList = container.querySelector('#available-matches-list');
      expect(matchList?.innerHTML).toContain('available-match-1');
    });

    it('should call join endpoint without body', async () => {
      let receivedBody: unknown = 'NOT_SET';
      const testMatchId = 'match-to-join';

      server.use(
        http.post('/api/game/match/:matchId/join', async ({ request }) => {
          const text = await request.text();
          receivedBody = text || null;

          return HttpResponse.json({
            matchId: testMatchId,
            mode: '1v1',
            creatorAlias: 'creator_user',
            joinerAlias: 'test_user',
            websocketUrl: `/ws/game/${testMatchId}`,
          });
        })
      );

      const joinBtn = container.querySelector('#remote-join-btn') as HTMLButtonElement;
      joinBtn.click();

      // Wait for join screen to appear
      await vi.waitFor(() => {
        const joinScreen = container.querySelector('#join-match-screen');
        expect(joinScreen?.classList.contains('hidden')).toBe(false);
      });

      // Enter match ID and confirm
      const matchIdInput = container.querySelector('#match-id-input') as HTMLInputElement;
      const confirmBtn = container.querySelector('#confirm-join-btn') as HTMLButtonElement;

      matchIdInput.value = testMatchId;
      confirmBtn.click();

      await vi.waitFor(
        () => {
          expect(receivedBody).not.toBe('NOT_SET');
        },
        { timeout: 1000 }
      );

      // Join should not send a body
      expect(receivedBody).toBeNull();

      // Give time for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('Authentication State', () => {
    it('should disable remote buttons when not authenticated', async () => {
      // Clear and re-render with unauthenticated state
      container.innerHTML = '';
      vi.spyOn(auth, 'isAuthenticated').mockResolvedValue(false);

      await renderPlayPage(container, mockRenderNavBar, mockSetupNavigation);

      const quickmatchBtn = container.querySelector('#remote-quickmatch-btn') as HTMLButtonElement;
      const createBtn = container.querySelector('#remote-create-btn') as HTMLButtonElement;
      const joinBtn = container.querySelector('#remote-join-btn') as HTMLButtonElement;

      expect(quickmatchBtn.disabled).toBe(true);
      expect(createBtn.disabled).toBe(true);
      expect(joinBtn.disabled).toBe(true);

      const loginHint = container.querySelector('#remote-login-hint');
      expect(loginHint?.classList.contains('hidden')).toBe(false);
    });

    it('should enable remote buttons when authenticated', async () => {
      const quickmatchBtn = container.querySelector('#remote-quickmatch-btn') as HTMLButtonElement;
      const createBtn = container.querySelector('#remote-create-btn') as HTMLButtonElement;
      const joinBtn = container.querySelector('#remote-join-btn') as HTMLButtonElement;

      expect(quickmatchBtn.disabled).toBe(false);
      expect(createBtn.disabled).toBe(false);
      expect(joinBtn.disabled).toBe(false);

      const loginHint = container.querySelector('#remote-login-hint');
      expect(loginHint?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Mode Selection Screen', () => {
    it('should show local game buttons', () => {
      const localGameBtn = container.querySelector('#local-game-btn');
      const localGameVersusBotBtn = container.querySelector('#bot-opponent-btn');
      const tournamentBtn = container.querySelector('#tournament-btn');

      expect(localGameBtn).toBeTruthy();
      expect(localGameVersusBotBtn).toBeTruthy();
      expect(tournamentBtn).toBeTruthy();
      expect(localGameBtn?.textContent).toContain('Local 1v1');
      expect(tournamentBtn?.textContent).toContain('Local Tournament');
    });

    it('should show remote game buttons', () => {
      const quickmatchBtn = container.querySelector('#remote-quickmatch-btn');
      const createBtn = container.querySelector('#remote-create-btn');
      const joinBtn = container.querySelector('#remote-join-btn');

      expect(quickmatchBtn).toBeTruthy();
      expect(createBtn).toBeTruthy();
      expect(joinBtn).toBeTruthy();
    });
  });
});
