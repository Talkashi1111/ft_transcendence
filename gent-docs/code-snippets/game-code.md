## Cross-Site Scripting (XSS)

The primary security risk with `innerHTML` is **Cross-Site Scripting (XSS)**.

When you use `innerHTML`, the browser takes the string you provide and parses it as actual HTML code. If any part of that string comes from a user (like a username, a chat message, or a URL parameter) and hasn't been cleaned, a malicious user can "inject" their own scripts into your page.

### How an attack works:

Imagine you have a piece of code that displays a player's name:

```typescript
// UNSAFE
const username = "<img src='x' onerror='alert(\"Hacked!\")'>";
app.innerHTML = `<div>Welcome, ${username}</div>`;
```

1.  The attacker sets their username to a broken HTML tag with an `onerror` attribute.
2.  `innerHTML` tells the browser: "Render this image."
3.  The image fails to load (because `src='x'` is invalid).
4.  The `onerror` JavaScript executes automatically.

Instead of just an `alert`, an attacker could steal session cookies, redirect the user to a fake login page, or perform actions on behalf of the user.

### Why your current code is "Safe-ish":

In the code your colleague wrote, they are using a helper function called `escapeHtml`:

```typescript
// From your play.ts
<span class="font-medium text-gray-800">${escapeHtml(player.alias)}</span>
```

This function converts dangerous characters like `<` and `>` into "entities" (`&lt;` and `&gt;`). This prevents the browser from seeing them as HTML tags, effectively neutralizing the script.

### Safer Alternatives:

1.  **`textContent`**: If you only need to update text, use `element.textContent = userProvidedString;`. The browser will never parse this as HTML, so it is 100% immune to XSS.
2.  **`innerText`**: Similar to `textContent`, but aware of CSS styling (e.g., won't show text hidden by CSS).
3.  **DOM API**: As mentioned in "Point 2" earlier, using `document.createElement` and setting properties directly is inherently safe because you aren't passing raw strings to the HTML parser.

---

## id="canvas"

Here is the precise breakdown of the lifecycle of that canvas element:

### 1. Declaration & Size

The `<canvas>` element itself **does not** have the `hidden` attribute on line 95.

- It is the **parent container** (`<div id="game-screen">`) that has the `hidden` class.
- The canvas itself has `class="block"`.

**Where is the size defined?**
It is **not** defined in the HTML. It is defined in TypeScript when the game starts.

- **File:** renderer.ts
- **Function:** `setupCanvas()`
- **Values:** It uses `GAME_CONFIG.canvasWidth` (800) and `GAME_CONFIG.canvasHeight` (600) from config.ts.

### 2. Variable Storage

- **File:** `src/pages/play.ts` (Line 252)
- It is retrieved from the DOM and cast to a TypeScript type:
  ```typescript
  const canvas = document.getElementById('pong-canvas') as HTMLCanvasElement;
  ```

### 3. Game Start

- When you click "Start Game", the app removes the `hidden` class from the parent `game-screen` div.
- It then instantiates the game class: `new PongGame(canvas, ...)`

### 4. PongGame Class

- **File:** `src/game/pong.ts`
- The constructor receives the `canvas` element.
- It passes it to `setupCanvas(canvas)`, which sets the size (800x600) and returns the `CanvasRenderingContext2D` (the "pen" used to draw).

---

## high-DPI

- canvas.width/height control the canvas drawing buffer (number of pixels the canvas can draw into).
- CSS width/height (e.g., canvas.style.width) control how large the canvas appears on the page (layout size in CSS pixels).
- On high-DPI (Retina) screens, 1 CSS pixel = multiple device pixels (devicePixelRatio, often 2). To render crisply, you should scale the drawing buffer by devicePixelRatio and then scale the 2D context so your drawing code keeps using the same logical (CSS) coordinates.  
  ...

---

## requestAnimationFrame (rAF)

is a native browser method specifically designed for animations and games.

### 1. Screen Synchronization

Unlike setInterval or setTimeout which run at fixed intervals, rAF synchronizes with the display refresh rate (60Hz, 120Hz, 144Hz, etc.). The browser calls your code exactly before the next screen repaint.

### 2. Resource Optimization

If the user switches tabs or minimizes the window, rAF automatically pauses. This saves CPU and battery, unlike setInterval which continues to run in the background.

### 3. Visual Smoothness

rAF ensures that state changes (like object positions) are rendered at the exact moment the screen updates. This eliminates stuttering and screen tearing.

### 4. Recursive Pattern

rAF is not an automatic loop; it executes the provided function only once. To create a continuous game loop, the function must call rAF again at the end of its execution:
JavaScript

```typescript
function loop() {
  // 1. Logic and Rendering
  update();
  render();

  // 2. Schedule the next frame
  requestAnimationFrame(loop);
}

// Initial call
requestAnimationFrame(loop);
```

It drives the gameLoop with high performance. The if (status !== 'finished') condition allows the game to break the recursion and stop once the match is over.

---

checkPaddleCollision() in physics.ts
That condition is true when the ball's bounding square (not circle!) and the paddle rectangle overlap (a simple, fast collision test)  
Pros: cheap and easy; works well for most pong-style games.
Cons: conservative — it can report collisions when the ball’s square overlaps the paddle but the actual circular ball would not touch the paddle (corner cases). It also doesn’t handle very fast “tunneling” (ball skipping through thin paddles).  
Do not care

---

## Tailwind CSS

**Tailwind CSS** is a _utility-first CSS framework_ used to build custom user interfaces directly in HTML (or JSX, templates, etc.) without writing traditional CSS files.

Instead of providing pre-designed components (buttons, cards, navbars), Tailwind provides **low-level utility classes** that each apply a single, specific style rule.

### Core Concept

Tailwind replaces this approach:

```css
.card {
  padding: 1rem;
  background-color: white;
  border-radius: 0.5rem;
}
```

With this:

```html
<div class="p-4 bg-white rounded-lg"></div>
```

You compose styles **by combining utility classes**.

### Key Characteristics

**Utility-first**
Each class does exactly one thing:

- `p-4` → padding
- `text-center` → text alignment
- `bg-blue-500` → background color
- `rounded-xl` → border radius

**No predefined UI components**
Tailwind does not impose a design system. You build your own components.

**Highly configurable**
Design tokens (colors, spacing, fonts, breakpoints) are defined in a configuration file (`tailwind.config.js`).

**Responsive by design**
Responsive behavior is expressed inline:

```html
<div class="text-sm md:text-lg lg:text-xl"></div>
```

**State variants**
Hover, focus, active, etc. are handled declaratively:

```html
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2">
  ...
  <div class="flex flex-col items-center"></div>
</button>
```

- flex: Applies `display: flex;` It initializes the Flexbox layout context for all immediate child elements.
- flex-col: Applies `flex-direction: column;` This stacks the child elements (the canvas container and the button div) vertically instead of horizontally.
- items-center: Applies `align-items: center;` In a column layout, this centers the children along the cross-axis, which is horizontally.

### Why Developers Use Tailwind

**Speed of development**
No context switching between HTML and CSS files.

**Consistency**
Design decisions are centralized in the configuration.

**Maintainability**
No large CSS files, no naming conventions (BEM, etc.), no dead CSS.

**Scales well**
Common in React, Vue, Next.js, and modern front-end stacks.

### Trade-offs

**Verbose markup**
HTML can become class-heavy.

**Learning curve**
Requires memorizing utility naming conventions.

**Not semantic CSS**
Styles live in markup rather than reusable class abstractions.

---

## La règle d'or : la logique dicte l'interface.

Si tu fais le design maintenant, tu devras probablement tout casser quand tu réaliseras que ta logique de bot fonctionne différemment.

---

## Object

Tu as raison techniquement : la boucle `for (const k in obj)` existe en JavaScript.

Cependant, je te l'ai déconseillée (et j'ai dit "on ne peut pas faire une boucle `forEach`") pour deux raisons précises : une liée à la **sécurité du code** et l'autre à **TypeScript**.

Voici pourquoi on évite `for...in` sur un objet aujourd'hui :

### 1. Le piège de l'héritage (Prototype)

La boucle `for...in` parcourt les propriétés de l'objet **ET** celles héritées de ses parents.

Si une librairie tiers ou un script malicieux ajoute une fonction à tous les objets (ex: `Object.prototype.hack = function() {}`), ta boucle `for...in` va passer sur 'dumb', 'easy'... et soudainement sur 'hack'. Ton code va planter car il essaiera de traiter 'hack' comme un bouton.

`Object.keys(...)` ne renvoie **que** les clés qui appartiennent vraiment à l'objet, ce qui est beaucoup plus sûr.

### 2. Le blocage TypeScript

Même si tu utilises `for (const k in botButtons)`, TypeScript considère que `k` est une `string` générique.

Regarde ce qui se passe si tu essaies :

```typescript
for (const k in botButtons) {
  // ERREUR TYPESCRIPT ICI !
  // TS va dire : "Je ne peux pas utiliser une string quelconque pour indexer botButtons."
  // "botButtons attend 'dumb' | 'easy'..., mais k est juste string."
  const btn = botButtons[k];
}
```

Pour que ça marche, tu serais obligé de forcer le type à chaque ligne :

```typescript
for (const k in botButtons) {
  const level = k as BotDifficulty; // Tu dois faire le casting ici de toute façon
  const btn = botButtons[level];
  // ...
}
```

### Résumé

L'approche `Object.keys(...)` transforme ton objet en Tableau.

1. **Les Tableaux ont la méthode `.forEach()**` (les objets non).
2. **C'est plus sûr** (pas de pollution par l'héritage).
3. **C'est plus facile à typer** en une seule fois comme on l'a fait (`as BotDifficulty[]`).

Garde la version `Object.keys()`, c'est la norme professionnelle actuelle en TypeScript/React/Moderne JS.

## Héritage prototypal

C'est une excellente question fondamentale. En JavaScript, **tout objet a une "famille" cachée**.

C'est le concept de **l'Héritage Prototypal**.

Voici l'explication simple sans jargon académique :

### 1. Le "Sac à dos" invisible (Le Prototype)

Quand tu crées ton objet `botButtons` :

```typescript
const botButtons = {
  dumb: ...,
  medium: ...
};
```

Tu as l'impression qu'il ne contient que `dumb` et `medium`.

En réalité, JavaScript lui attache automatiquement un **parent** (le prototype `Object`). Ce parent lui fournit une trousse à outils de base pour qu'il fonctionne.

Si tu tapes `botButtons.toString()` dans ta console, ça marche ! Pourtant, tu n'as jamais écrit la fonction `toString` dans ton objet.
**D'où vient-elle ?** De son parent.

### 2. Le problème du `for...in`

La boucle `for...in` est très (trop) curieuse. Elle va chercher :

1. Ce que TU as mis dans l'objet (`dumb`, `medium`...).
2. Ce qui a été ajouté dans le **Parent**.

**Scénario catastrophe :**
Imagine qu'une librairie externe (ou un collègue maladroit) fasse ceci n'importe où dans le projet :

```javascript
// On ajoute une méthode "hack" au Grand-Parent de tous les objets
Object.prototype.superHack = function () {
  console.log('Je suis partout !');
};
```

Si tu utilises `for (const k in botButtons)`, voici ce qui se passe :

- Tour 1 : `k = "dumb"` -> OK
- Tour 2 : `k = "medium"` -> OK
- Tour 3 : `k = "superHack"` -> **CATASTROPHE**

Ton code va essayer de faire `botButtons["superHack"]` pour trouver un bouton HTML, mais il trouvera une fonction. Ton interface va planter.

### 3. La solution `Object.keys()`

La méthode `Object.keys(botButtons)` est stricte. Elle dit :

> "Donne-moi UNIQUEMENT ce que **l'utilisateur** a écrit directement dans cet objet. Ignore les parents, ignore les outils par défaut, ignore le reste."

C'est pour ça que c'est la méthode sécurisée et standard aujourd'hui.

**En résumé :**

- **`for...in`** : Regarde tes affaires + les affaires de tes ancêtres (risqué).
- **`Object.keys()`** : Ne regarde que tes affaires à toi (sûr).

---
## paddle collision

C'est un facteur de normalisation pour obtenir une plage de valeurs allant de **-1 à 1**.

Voici le détail mathématique de la transformation :

1. **L'entrée (`hitPosition`) :**
La ligne précédente `(ball.y - paddle.y) / paddle.height` donne une valeur entre **0 et 1**.
* `0` = Haut de la raquette.
* `0.5` = Centre exact.
* `1` = Bas de la raquette.


2. **Le centrage (`- 0.5`) :**
En soustrayant 0.5, on décale la plage pour qu'elle soit centrée sur zéro.
* Plage obtenue : **-0.5 à 0.5**.
* Problème : Si on multiplie la vitesse par 0.5 max, la balle partira trop "droit" (angle trop faible).


3. **La mise à l'échelle (`* 2`) :**
On multiplie par 2 pour étendre la plage de **-1 à 1**.

**Résultat final sur `angleMultiplier` :**

| Impact sur la raquette | hitPosition | Calcul | angleMultiplier | Effet sur la balle |
| --- | --- | --- | --- | --- |
| **Tout en haut** | 0.0 |  | **-1.0** | Vitesse Y max vers le **Haut** (négatif) |
| **Centre** | 0.5 |  | **0.0** | Tout droit (Horizontale parfaite) |
| **Tout en bas** | 1.0 |  | **1.0** | Vitesse Y max vers le **Bas** (positif) |

Cela permet ensuite à la ligne `ball.velocityY = ball.speed * angleMultiplier` d'exploiter la totalité de la vitesse pour l'angle vertical si nécessaire.