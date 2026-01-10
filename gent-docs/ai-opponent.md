The implementation of the ai opponent is located in frontend/src/game/bot-pong.ts

## Requirements of the module

In this major module, the objective is to incorporate an AI player into the game. Notably, the use of the A\* algorithm is not permitted for this task. Key features and goals include:

- Provides a challenging and engaging gameplay for users
- AI must replicate human behavior, which means that in your AI implementation, you must simulate keyboard input. The constraint here is that the AI can only refresh its view of the game once per second, requiring it to anticipate bounces and other actions.
- Implement AI logic and decision-making processes that enable the AI player to make intelligent and strategic moves
- Explore alternative algorithms and techniques to create an effective AI player without relying on A\*
- Ensure that the AI adapts to different gameplay scenarios and user interactions.

## Definition of AI


## Levels

There are five levels for the bot

### 1. Paw patrol

Moves up and down like a patrol (5 lines of code)

### 2. Track-y

Track the ball's vertical position (8 lines of code)

### 3. Human-like behavior

This bot logic simulates a human player. First, we have to define how a regular user plays.  
Let's set timestamps from when the ball is returned by the opponent's paddle until the ball arrives at the vertical line of the player's paddle.

- At t0, the ball touches the opponent's paddle; The player "stores" instinctively the ball's position
- At t1, the ball comes toward the player's paddle, "stores" the ball's second position. The player knows now the direction of the ball and can predicts a vague strike zone. He moves until he arrives in his predicted strike zone.
- At t2, the ball coming closer, the player predicts a more precise strike zone and adjust its position.
- At t3, when the ball is about to hit, the player (if he is a pro) might want to hit the ball with a certain angle so the ball goes the furthest to the opponent.
- After hitting the ball, the player might replaces a little bit to the center of the paddle

To simulate human's gameplay, the bot will:

- From the first two views, the exact hit point will be calculated (bounce included).
- Will see the game state once per second and decides an action.
- Depending on the distance ball-bot's paddle, the exact hit point will be "enlarged" to a zone. The closer the ball is to the bot, preciser the zone will be.

### 4. Hard

The bot will hit the ball so it arrives to the furthest from the player's position

----

# Code

Below is a precise, step-by-step explanation of what this TypeScript code does and *why* it is written this way.

---

## 1. The `BotLevel` constant object

```ts
export const BotLevel = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
} as const;
```

### What this does

* Defines an **object** named `BotLevel` that maps symbolic names (`LEVEL_1`, etc.) to numeric values.
* Exports it so it can be used in other modules.

### The role of `as const`

`as const` tells TypeScript to:

1. Make the object **readonly**
2. Infer the **most specific literal types possible**

Without `as const`:

```ts
LEVEL_1: number
```

With `as const`:

```ts
LEVEL_1: 1
```

So the inferred type becomes:

```ts
{
  readonly LEVEL_1: 1;
  readonly LEVEL_2: 2;
  readonly LEVEL_3: 3;
  readonly LEVEL_4: 4;
}
```

This is crucial for the type extraction in the next step.

---

## 2. The `BotLevel` type alias

```ts
export type BotLevel = typeof BotLevel[keyof typeof BotLevel];
```

This line looks dense, so let’s break it down piece by piece.

---

### Step 1: `typeof BotLevel`

In TypeScript, `typeof` (in a type position) extracts the **type of a value**.

```ts
typeof BotLevel
```

Becomes:

```ts
{
  readonly LEVEL_1: 1;
  readonly LEVEL_2: 2;
  readonly LEVEL_3: 3;
  readonly LEVEL_4: 4;
}
```

---

### Step 2: `keyof typeof BotLevel`

`keyof` produces a **union of the object’s keys**:

```ts
keyof typeof BotLevel
```

Result:

```ts
"LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4"
```

---

### Step 3: Index access type

```ts
typeof BotLevel[keyof typeof BotLevel]
```

This means:

> “Give me the type of the values corresponding to all keys.”

Since the values are `1 | 2 | 3 | 4`, the final type becomes:

```ts
1 | 2 | 3 | 4
```

---

## 3. Final result

You end up with:

### Runtime value

```ts
BotLevel.LEVEL_1 === 1
```

### Compile-time type

```ts
type BotLevel = 1 | 2 | 3 | 4;
```

---

## 4. Why this pattern is useful

This pattern gives you **enum-like behavior without using `enum`**:

### Advantages over `enum`

* No generated JavaScript code for enums
* Full tree-shaking support
* Strong literal typing
* Single source of truth for values *and* types

---

## 5. Example usage

```ts
function setBotLevel(level: BotLevel) {
  // level can ONLY be 1, 2, 3, or 4
}

setBotLevel(2);        // OK
setBotLevel(5);        // ❌ Type error
setBotLevel(BotLevel.LEVEL_3); // OK
```

---

## 6. Mental model

Think of it as:

* **Object** → runtime values
* **Type alias** → union of allowed values
* `as const` → prevents widening to `number`

---

If you want, I can also explain:

* How this compares directly to `enum`
* How to extract the **keys** instead of values
* How to extend this pattern safely

Just let me know.

# Execution waterfall

1. **`gameLoop`**: Runs via `requestAnimationFrame` (usually matches screen refresh rate, e.g., 60Hz or 144Hz).
2. **`update`**: Inside `gameLoop`, a `while` loop ensures this runs at a **fixed timestep** of 60 FPS (defined in `GAME_CONFIG.fps`).
3. **`handleInput`**: Called inside `update` every single tick.
4. **`handleBotMovement`**: Called inside `handleInput` every single tick.
5. **`godLikeBot`**: Called inside the switch statement every single tick if the level is selected.

---

```ts
private readonly level: BotLevel;
```
`readonly` allows assignment in the declaration or constructor, then prevents later reassignment (TypeScript will error if you try).

---