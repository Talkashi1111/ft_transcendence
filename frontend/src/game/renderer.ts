import type { GameState } from '../types/game';
import { GAME_CONFIG, COLORS } from './config';

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = GAME_CONFIG.canvasWidth;
  canvas.height = GAME_CONFIG.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);
}

export function drawCenterLine(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(GAME_CONFIG.canvasWidth / 2, 0);
  ctx.lineTo(GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawBall(ctx: CanvasRenderingContext2D, gameState: GameState): void {
  const { ball } = gameState;
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.fillStyle = COLORS.paddle;
  ctx.fillRect(x, y, width, height);
}

export function drawScore(ctx: CanvasRenderingContext2D, gameState: GameState): void {
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';

  // Player 1 score (left)
  ctx.fillText(gameState.player1.paddle.score.toString(), GAME_CONFIG.canvasWidth / 4, 60);

  // Player 2 score (right)
  ctx.fillText(gameState.player2.paddle.score.toString(), (GAME_CONFIG.canvasWidth * 3) / 4, 60);
}

export function drawPlayerNames(ctx: CanvasRenderingContext2D, gameState: GameState): void {
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';

  // Player 1 name (left)
  ctx.fillText(gameState.player1.alias, GAME_CONFIG.canvasWidth / 4, 100);

  // Player 2 name (right)
  ctx.fillText(gameState.player2.alias, (GAME_CONFIG.canvasWidth * 3) / 4, 100);
}

export function drawCountdown(ctx: CanvasRenderingContext2D, countdown: number): void {
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(countdown.toString(), GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2);
}

export function drawPauseScreen(ctx: CanvasRenderingContext2D): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2);

  ctx.font = '20px Arial';
  ctx.fillText(
    'Press SPACE to resume',
    GAME_CONFIG.canvasWidth / 2,
    GAME_CONFIG.canvasHeight / 2 + 50
  );
}

export function drawWinnerScreen(ctx: CanvasRenderingContext2D, winner: string): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, GAME_CONFIG.canvasWidth, GAME_CONFIG.canvasHeight);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${winner} WINS!`, GAME_CONFIG.canvasWidth / 2, GAME_CONFIG.canvasHeight / 2);
}

export function render(ctx: CanvasRenderingContext2D, gameState: GameState): void {
  clearCanvas(ctx);
  drawCenterLine(ctx);
  drawScore(ctx, gameState);
  drawPlayerNames(ctx, gameState);

  // Draw paddles
  drawPaddle(
    ctx,
    gameState.player1.paddle.x,
    gameState.player1.paddle.y,
    gameState.player1.paddle.width,
    gameState.player1.paddle.height
  );
  drawPaddle(
    ctx,
    gameState.player2.paddle.x,
    gameState.player2.paddle.y,
    gameState.player2.paddle.width,
    gameState.player2.paddle.height
  );

  // Draw ball
  drawBall(ctx, gameState);

  // Draw overlays based on status
  if (gameState.status === 'countdown' && gameState.countdown > 0) {
    drawCountdown(ctx, gameState.countdown);
  } else if (gameState.status === 'paused') {
    drawPauseScreen(ctx);
  } else if (gameState.status === 'finished' && gameState.winner) {
    drawWinnerScreen(ctx, gameState.winner);
  }
}
