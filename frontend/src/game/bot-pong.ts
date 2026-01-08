import { PongGame } from './pong';
import { movePaddle } from './physics';
import { GAME_CONFIG } from './config';

export class BotPongGame extends PongGame {
    private botDirection: 'up' | 'down' = 'down';
    private difficulty: number;

    constructor(canvas: HTMLCanvasElement, player1Alias: string, selectedDifficulty: number) {
        // Call parent constructor with "Bot (Lvl X)" as player 2 alias
        super(canvas, player1Alias, 'Bot');
        this.difficulty = selectedDifficulty;
    }

    // Override handleInput to replace player 2 controls with bot logic
    protected override handleInput(): void {
        // Player/User controls
        if (this.inputHandler.isPlayer1UpPressed() || this.inputHandler.isPlayer2UpPressed()) {
            movePaddle(this.gameState.player1.paddle, 'up');
        }
        if (this.inputHandler.isPlayer1DownPressed() || this.inputHandler.isPlayer2DownPressed()) {
            movePaddle(this.gameState.player1.paddle, 'down');
        }

        // IA Control
        this.handleBotMovement();
    }

    private handleBotMovement(): void {
        if (this.difficulty === 1) {
            this.patrolBot();
        } else if (this.difficulty === 2) {
            this.trackingBallBot();
        } else {
            alert('Difficulty level not implemented yet. AI does nothing.');
        }
    }

    // patrol from top to bottom and from bottom to top continuously
    private patrolBot(): void {
        const paddle = this.gameState.player2.paddle;

        if (paddle.y + paddle.height >= GAME_CONFIG.canvasHeight) {
            this.botDirection = 'up';
        }
        if (paddle.y <= 0) {
            this.botDirection = 'down';
        }

        movePaddle(paddle, this.botDirection);
    }

    // Track the ball's vertical position (ball.y)
    private trackingBallBot(): void {
        const ball = this.gameState.ball;
        const paddle = this.gameState.player2.paddle;
        const paddleCenter = paddle.y + paddle.height / 2;

        // If the ball is above the paddle center, move up; if below, move down
        // Add a margin of 10px to prevent jittery movement
        if (ball.y < paddleCenter - 10) {
            movePaddle(paddle, 'up');
        } else if (ball.y > paddleCenter + 10) {
            movePaddle(paddle, 'down');
        }
        // Else, do nothing (ball is within margin)
    }

    // View the game once per second, anticipates hit zone when ball is moving toward bot
    private humanLikeBot(): void {
        const ball = this.gameState.ball;
        const paddle = this.gameState.player2.paddle;
        const paddleCenter = paddle.y + paddle.height / 2;

        // 1. View the game once per second. What does it mean ? It only needs one "look" at the ball position to decide where to go.

        // 2. Anticipate hit zone (?with one bounce) when ball is moving toward bot
        
    }
}