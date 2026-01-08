# Some snippets of ./frontend/src/main.ts explained

# Union type
```typescript
let currentPage: 'home' | 'login' | 'register' | 'play' | 'tournaments' = 'home';
```
This line is doing two things at once: **Declaring a variable** and **Defining a Union Type**.
1. The Variable Declaration
let currentPage = 'home'; This creates a variable named `currentPage` and gives it the initial value `'home'`.
2. The Type Definition (The Magic Part)
`: 'home' | 'login' | 'register' | 'play' | 'tournaments'`
This is a String Literal Union Type.
It tells TypeScript: "This variable can ONLY hold one of these 5 specific strings. It cannot hold any other string."

If you try to write this later in your code:
currentPage = 'dashboard'; // Error!
TypeScript will stop you and say: "Type '"dashboard"' is not assignable to type '"home" | "login" | "register" | "play" | "tournaments"'."
This prevents typos (like `currentPage = 'hom'`) and ensures your router only ever tries to navigate to valid pages. It's much safer than just using `string`.

---
# CustomEvent

```typescript
// In main.ts
window.addEventListener('navigate', ((event: CustomEvent) => {
    const page = event.detail.page;
    if (
      page === 'home' ||
      page === 'login' ||
      page === 'register' ||
      page === 'play' ||
      page === 'tournaments'
    ) {
      navigate(page);
    }
  }) as EventListener);

// In login.ts
const event = new CustomEvent('navigate', { detail: { page: 'home' } });
window.dispatchEvent(event);
```
This block of code is setting up a **Custom Event Listener**.  
1.  **`window.addEventListener('navigate', ...)`**
    *   This tells the browser: "Hey, I want to listen for a specific signal called `'navigate'`."
    *   Whenever someone broadcasts this signal, run the function inside.

2.  **`(event: CustomEvent)`**
    *   When the signal is received, it comes with a package of data called `event`.
    *   We tell TypeScript this is a `CustomEvent` (a special type of event that can carry extra data).

3.  **`const page = event.detail.page;`**
    *   Inside the package (`event`), there is a special pocket called `detail`.
    *   Inside that pocket, we expect to find the name of the page we want to go to (e.g., `'login'`).

4.  **The `if` check**
    *   It checks if the `page` is one of the valid pages (`home`, `login`, etc.).
    *   This is a safety check to make sure we don't try to navigate to a page that doesn't exist.

5.  **`navigate(page);`**
    *   If the page is valid, it calls the main `navigate` function to actually change the screen.

### Why do we need this?
Imagine you are in the **Login Page** code (`login.ts`). When the user successfully logs in, you want to send them to the **Home Page**.

*   **Option A (Bad)**: Import the `navigate` function from main.ts into `login.ts`. This creates a "Circular Dependency" (Main needs Login, Login needs Main), which causes bugs.
*   **Option B (Good)**: The Login Page just broadcasts a message: "Hey, someone please navigate to 'home'!" The code (in login.ts) sends a signal to himself. The piece of code in main.ts will catch it and performs the navigation. This keeps the files independent and clean.  

This means you can change how navigation works in main.ts (e.g., add a fancy animation) without ever touching login.ts. They are loosely connected, which makes the code easier to maintain.

---
# async

- When you write:
  ```ts
  const authenticated = await isAuthenticated();
  ```
  - `isAuthenticated()` is invoked and returns a Promise.
  - `render` is suspended at that `await` point (its execution is paused).
  - The JavaScript event loop remains free — other tasks and UI updates run while `render` is paused.
  - When the Promise resolves (or rejects), `render` continues (or throws an error you can catch).

- Important: `await` does *not* freeze the whole thread — only the async function's execution is paused.

### Tiny example (order of events) 🧭
```ts
async function isAuthenticated() {
  await fetch('/api/me'); // async work
  return true;
}

async function render() {
  console.log('before');
  const auth = await isAuthenticated(); // <-- render pauses here
  console.log('after', auth);
}

render();
console.log('other work');
```
Console output:  
1. "before"  
2. "other work"  (runs while `render` is waiting)  
3. "after true"  (after fetch completes and the Promise resolves)

---

If you want parallel execution, start promises without awaiting and use `Promise.all()` to wait for them together.

---
# Piece of Architecture
```typescript
  if (currentPage === 'login') {
    renderLoginPage(app, renderNavBar, setupNavigation, () => {
      // After successful login, go to home
      navigate('home');
    });
  } else {...}
```
Why the 4th argument, the function is declared here ? There is a very specific architectural reason: **Separation of Concerns**.

1.  **login.ts is "Dumb" (in a good way):**
    The `renderLoginPage` function only knows *how* to display the form and *how* to talk to the API. It does not know (and shouldn't know) about the rest of the application's flow. It just reports: *"I am finished successfully."*

2.  **`main.ts` is the "Manager":**
    The `main.ts` file acts as the **Router** or Controller. It is the only one that knows that "After Login, the user should go to Home."

**Why is this better?**
Imagine you wanted to change the behavior later so that after logging in, the user is sent to their **Profile** page instead of Home.
*   **With this design:** You only change one line in `main.ts`. You don't touch login.ts at all.
*   **Without this design:** You would have to open login.ts, find the hardcoded `navigate('home')`, and change it, mixing navigation logic with UI logic.

It makes the login.ts component reusable and easier to maintain.

---
# Async function returns a Promise

async = en français; attendre, être dans l'attente de  
In JavaScript/TypeScript, if you mark a function with the `async` keyword, it **always** returns a `Promise`, no matter what you return inside.

**Examples:**

1.  **Returning a value:**
    ```typescript
    async function hello() {
      return "world"; // Looks like a string...
    }
    // ...but it actually returns Promise<string>
    ```

2.  **Returning nothing:**
    ```typescript
    async function doWork() {
      console.log("Working...");
    }
    // Returns Promise<void>
    ```

3.  **Returning a Promise explicitly:**
    ```typescript
    async function check() {
      return Promise.resolve(true);
    }
    // Returns Promise<boolean> (it doesn't wrap it twice)
    ```

So, `async` is basically a guarantee to the caller: *"I might take some time, so treat my result as a Promise."*  

A Promise is a JavaScript object that represents a value that you don't have yet, but will have in the future.

---
# Example of fetch, API request, await...
## Frontend
In frontend/utils/auth.js
```typescript
/**
 * Get current user info from API (fresh data from database)
 * Cookie is automatically sent with credentials: 'include'
 * @returns Fresh user info from database or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/users/me', {
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      return null;
    }

    const user: AuthUser = await response.json();
    return user;
  } catch {
    return null;
  }
}
```
### 1. How `fetch` works
`fetch` is the modern way to make network requests in JavaScript. It is a function that takes two arguments:
1.  **The URL** (string): Where to send the request (e.g., `'/api/users/me'`).
2.  **The Options** (object): How to send the request.

### 2. The Second Argument
Yes, the second argument is a plain JavaScript **Object**. It allows you to configure the details of the request.
Common properties inside this object include:
*   `method`: 'GET', 'POST', 'PUT', 'DELETE' (default is 'GET').
*   `headers`: An object of HTTP headers (e.g., `{'Content-Type': 'application/json'}`).
*   `body`: The data you want to send (usually a JSON string).
*   `credentials`: Controls if cookies are sent ('omit', 'same-origin', or 'include').

### 3. The Comma after `'include'`
```typescript
credentials: 'include', // <--- This comma
```
**Is it necessary?**
**No.** The code will work perfectly fine without it.

**Why is it there?**
It is called a **Trailing Comma**. It is a very common coding style in modern JavaScript/TypeScript (and enforced by tools like Prettier).
*   **Benefit:** If you want to add another property later (like `mode: 'cors'`), you can just add a new line without having to go back and add a comma to the previous line. It makes "Git diffs" (code history) cleaner.

**Valid:**
```javascript
{
  credentials: 'include'
}
```

**Also Valid (and preferred style):**
```javascript
{
  credentials: 'include',
}
```

So this function from the frontend sends a GET request to the backend.
## Backend
The following piece of code, in backend/src/modules/user/user.route.ts handles the previous request sent by the frontend:
```typescript
  // Get current user profile
  server.get(
    '/me',
    {
      onRequest: [server.authenticate],
      schema: {
        description: 'Get current user profile',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: userResponseJsonSchema,
        },
      },
    },
    getMeHandler
  );
```

1.  **`server.get('/me', ...)`**: This tells Fastify to listen for GET requests at `/api/users/me` (the `/api/users` prefix comes from where this file is registered in `app.ts`).
2.  **`onRequest: [server.authenticate]`**: This is a "Guard". Before running the main function, it checks the cookie. If the cookie is missing or invalid, it immediately sends back a `401 Unauthorized` error.
3.  **`getMeHandler`**: If the guard passes, this function is called to fetch the user data from the database and return it.  
### 1. What is the second argument?
The second argument is the **Route Options** object. It configures everything about the route *except* the actual business logic.
It contains:
*   `onRequest`: Middleware to run before the handler (e.g., authentication).
*   `schema`: Documentation for Swagger (inputs, outputs, descriptions).

### 2. Can you extract it?
**Yes, absolutely.** And it is often done to keep the route file clean.

You can refactor it like this:

```typescript
// Define the options separately
const getMeOptions = {
  onRequest: [server.authenticate],
  schema: {
    description: 'Get current user profile',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    response: {
      200: userResponseJsonSchema,
    },
  },
};

// Use it in the route
server.get('/me', getMeOptions, getMeHandler);
```

### 3. How is it done in the industry?
There are two common schools of thought:

**Style A: Inline (What you see here)**
*   **Pros:** You see everything in one place. When reading the route, you immediately know "This route requires auth" and "This route returns a User schema".
*   **Cons:** The file gets very long and "noisy" with configuration.

**Style B: Extracted (What you suggested)**
*   **Pros:** The route definitions are very clean and readable:
    ```typescript
    server.get('/', getUsersOptions, getUsersHandler);
    server.get('/me', getMeOptions, getMeHandler);
    ```
*   **Cons:** You have to jump around the file (or to another file) to see if a route is protected or what it returns.

**Verdict:**
In Fastify projects, **Style A (Inline)** is actually very common because the `schema` part is often tightly coupled to the route definition. However, if the schema becomes huge (50+ lines), developers almost always move the schema to a separate file (like `user.schema.ts`) and import it, which is exactly what this project has done (`userResponseJsonSchema` is imported).

So, the current code is a "hybrid": The *structure* is inline, but the *heavy data* (the schemas) are imported. This is a standard industry practice.

---
  
# Optional parameter
The `?` in `authenticated?: boolean` marks the parameter as **Optional**.

### What it means:
1.  **You can call it with the argument:**
    ```typescript
    renderNavBar('home', true); // OK
    ```
2.  **You can call it WITHOUT the argument:**
    ```typescript
    renderNavBar('home'); // Also OK!
    ```

### Inside the function:
If you don't provide it, the value of `authenticated` will be `undefined`.

That is why the next line handles it:
```typescript
const isAuth = authenticated ?? (await isAuthenticated());
```
*   If `authenticated` is `true` or `false` (provided), use it.
*   If `authenticated` is `undefined` (not provided), go fetch the value.

---
# setupNavigation()
This function `setupNavigation` is responsible for making the navigation bar buttons actually work.

### The Problem
When `renderNavBar` runs, it just returns a big string of HTML:
```html
<button id="nav-home">Home</button>
<button id="nav-login">Login</button>
```
These buttons appear on the screen, but they are "dead". Clicking them does nothing because they have no event listeners attached.

### The Solution (`setupNavigation`)
This function runs *immediately after* the HTML is put on the screen.

1.  **Find the Buttons:**
    ```typescript
    const homeBtn = document.getElementById('nav-home');
    // ... finds all other buttons by their ID
    ```

2.  **Attach Listeners (The `?` again):**
    ```typescript
    homeBtn?.addEventListener('click', () => navigate('home'));
    ```
    *   **`?.` (Optional Chaining):** This is crucial.
        *   If you are logged out, the "Logout" button doesn't exist in the HTML. `logoutBtn` will be `null`.
        *   `logoutBtn.addEventListener(...)` would crash the app with "Cannot read property of null".
        *   `logoutBtn?.addEventListener(...)` safely ignores it if the button is missing.

3.  **The Action:**
    When clicked, it calls `navigate('home')`, which updates the state variable `currentPage` and re-runs `render()`, starting the cycle all over again.

---
# renderLoginPage() in frontend/src/pages/login.ts
This function `renderLoginPage` is the **Controller** for the Login screen. It orchestrates everything needed to show the login form and make it work.

### 1. Parameters (Inputs)
*   `app`: The DOM element where we will draw the page.
*   `renderNavBar`: A helper to get the HTML for the top menu.
*   `setupNavigation`: A helper to make the top menu buttons clickable.
*   `onLoginSuccess`: A function to run when the user successfully logs in (usually redirects to Home).

### 2. The Process
1.  **Get the Navbar:**
    ```typescript
    const navBar = await renderNavBar('login');
    ```
    It asks for the navigation bar HTML, specifically highlighting the "Login" tab.

2.  **Draw the UI (HTML):**
    ```typescript
    app.innerHTML = `...`;
    ```
    It completely replaces the screen content with:
    *   The Navbar we just got.
    *   A Login Form (Email, Password inputs).
    *   A "Login with Google" button.
    *   A "Register" link.

3.  **Activate the Navbar:**
    ```typescript
    setupNavigation();
    ```
    It re-attaches the click listeners to the "Home", "Register", etc. buttons in the navbar so they work.

4.  **Activate the Form:**
    ```typescript
    setupLoginForm(onLoginSuccess);
    ```
    It calls a helper function (defined below) that:
    *   Finds the `<form>` element.
    *   Listens for the `submit` event.
    *   When submitted, calls the `login()` API.
    *   If successful, calls `onLoginSuccess()`.
    *   If failed, shows an error message in red.

---
# Type Assertion
```typescript
const form = document.getElementById('login-form') as HTMLFormElement;
```
`HTMLFormElement` is a **Type**.

### Why on the right side?
In TypeScript, the `as` keyword is used for **Type Assertion**. It is always placed *after* the value you want to assert.

**Syntax:**
```typescript
const variableName = (someValue) as SomeType;
```

**Alternative Syntax (Left Side):**
You *can* put it on the left side, but it means something slightly different (Type Annotation):
```typescript
const form: HTMLFormElement = document.getElementById('login-form'); 
// ❌ Error!
```
This fails because `getElementById` returns `HTMLElement | null`. TypeScript says: *"I can't guarantee this is a Form. It might be null, or a div."*

So we use `as` on the right side to force it:
```typescript
const form = document.getElementById('login-form') as HTMLFormElement;
// ✅ "I promise it is a Form."
```

Think of `as` like a sticker you put on a box: *"Treat this box as if it contains a Form."*