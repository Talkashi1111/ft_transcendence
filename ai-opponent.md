**File Location:** `frontend/src/game/bot-pong.ts`

# Major Module: AI Opponent

In this major module, the objective is to incorporate an AI player into the game. Notably, the use of the A* algorithm is not permitted for this task. Key features and goals include:

* Develop an AI opponent that provides a challenging and engaging gameplay experience for users.
* The AI must replicate human behavior, which means the implementation must simulate keyboard input.
* **Constraint:** The AI can only refresh its view of the game once per second, requiring it to anticipate bounces and other actions.
* The AI must utilize power-ups if the Game Customization Options module is implemented.
* Implement AI logic and decision-making processes that enable the AI player to make intelligent and strategic moves.
* Explore alternative algorithms and techniques to create an effective AI player without relying on A*.
* Ensure that the AI adapts to different gameplay scenarios and user interactions.

You must explain in detail how your AI works during your evaluation. Creating an AI that does nothing is strictly prohibited; it must be capable of winning occasionally.

---

# AI Opponent Logic

### Heuristic-Based AI vs. Machine Learning

In game development, the distinction between these two determines how the "intelligence" is constructed.

| Feature | Heuristic-Based AI | Machine Learning (Modern AI) |
| --- | --- | --- |
| **Foundation** | Human-coded rules and logic. | Data-driven pattern recognition. |
| **Logic Style** | "If X happens, do Y." | "I've seen X before; Y usually wins." |
| **Resources** | Extremely lightweight; basic math. | Heavy; requires training and GPUs. |
| **Development** | Programmer defines the strategy. | Model discovers the strategy via trial/error. |
| **Transparency** | High (you can explain every move). | Low ("Black box" neural networks). |

**The AI implemented for this module is Heuristic-Based.**

### Implementation

The `BotPongGame` class inherits from the `PongGame` class (used for local 1v1), which handles:

1. **Game Loop & State Management**: Orchestrates the game lifecycle (countdown, playing, paused, finished) and runs the main `gameLoop` using `requestAnimationFrame`. It uses a fixed timestep for physics consistency and interpolation for smooth rendering.
2. **Physics & Logic**: Updates game entities via physics functions (e.g., ball movement, collisions) and manages game rules like scoring and win conditions.
3. **Input Handling**: Captures user input via an `InputHandler` to move paddles.
4. **Rendering**: Delegates visual output to a `render` function, passing the current game state to the HTML canvas.

`BotPongGame` selects a specific algorithm based on the `selectedLevel` and overrides the `handleInput` base method to replace the second player's input with the chosen AI strategy.

#### The Four AI Levels

The **"Human-Like"** level is the mode that meets the specific project requirements. While implementing human-like behavior was the primary challenge, other modes were kept to offer a better user experience and to demonstrate the evolution from simple scripts to AI.

**Level 1: Paw Patrol**

* **Behavior:** Moves the paddle continuously from the top of the screen to the bottom and back again.
* **Intelligence:** None. It does not track the ball or game state; it simply oscillates between boundaries.

**Level 2: Tracking (The "Reactive AI")**

* **Behavior:** Constantly adjusts the paddle to match the current Y-coordinate of the ball.
* **Intelligence:** Low. It reacts to the *present* position of the ball but cannot predict future movement. It includes a 10px "dead zone" to prevent jittery movement.

**Level 3: Human-Like (The "Heuristic AI")**  
To build this, we must first model how a human plays Pong. When a ball is returned, a player instinctively "snapshots" the ball's position. A moment later, they snapshot it again to determine a trajectory and estimate the impact zone on their defensive line. As the ball gets closer, the player refines this estimate and adjusts their movement.

* **1-Second Refresh Constraint:** Uses `Date.now()` to ensure the prediction logic only triggers once every 1000ms.
* **Predictive Logic:** Calls `predictBallY`, which uses velocity and position to calculate the intersection with the paddle's X-axis, accounting for wall bounces.
* **Simulated Error:** To mimic human imperfection, it calculates a "confidence ratio" based on distance. If the ball is far away, it adds a random `errorOffset` (up to 25% of board height). As the ball approaches, the prediction becomes more accurate.
* **Input Simulation:** Uses the `movePaddle` function to simulate key presses rather than "teleporting" the paddle.

**Level 4: God-Like (The "Optimal AI")**

* **Perfect Prediction:** Calculates the exact impact point once per volley and stores it in `cachedImpactY`.
* **Offensive Strategy:** Instead of just returning the ball, it tracks the opponent. If the opponent is positioned high, the AI aims low (and vice versa) by hitting the ball with a specific section of the paddle to manipulate the reflection angle.

---

### Why this qualifies as "AI"

This implementation transitions from a simple **Bot** (Level 1) to a **Narrow AI** (Levels 3 & 4). It demonstrates the three pillars of artificial intelligence:

1. **Perception:** Reading and interpreting the `gameState`.
2. **Reasoning:** Utilizing physics-based heuristics to calculate a `targetY`.
3. **Action:** Executing simulated movement commands to achieve a strategic goal.
