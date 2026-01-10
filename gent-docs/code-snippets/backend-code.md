# buildApp()

1. Initializes the Fastify server instance
2. Sets up Swagger/OpenAPI documentation for your API.

## Use of await

It is **not strictly required**, but it is **highly recommended** and considered best practice in modern Fastify applications.

Here is why:

1.  **Dependencies**: Some plugins depend on others. For example, `fastifySwaggerUi` needs `fastifySwagger` to be loaded first. Using `await` ensures the first plugin is fully initialized before the next one starts.
2.  **Decorators**: If a plugin adds a new function to the server (like `server.authenticate` added by `fastify-jwt`), you **must** await the registration if you want to use that function immediately afterwards in the same file.
3.  **Error Handling**: If a plugin fails to load (e.g., due to a bad configuration), using `await` allows your code to crash or catch the error **immediately** at that line. Without `await`, the error might happen asynchronously later, making it harder to debug.

**In summary**: You _could_ chain them like `server.register(...).register(...)`, but using `await` makes the code safer, easier to debug, and ensures dependencies are respected.

## server.register()

is the core method in Fastify used to add functionality to your server. It is used for two main things:

1.  **Adding Plugins**: It loads external libraries or features, like database connectors, authentication (JWT), or Swagger documentation.
2.  **Adding Routes**: It loads your route files (like `userRoutes` or `blockchainRoutes`) so the server knows how to handle requests to specific URLs.

**Key Concept: Encapsulation**  
Fastify is unique because `register` creates a **new scope**.

- If you define a variable or a "hook" (like a pre-request check) inside a registered plugin, it **only applies to that plugin and its children**. It does not leak out to the rest of the app.
- This keeps your application safe and modular. For example, you can register an authentication plugin only for the `/api/private` routes, and the `/api/public` routes won't be affected by it at all.

## server.decorate('authenticate', ...)

In Fastify, `server.decorate(name, value)` is used to extend the Fastify instance (or Request/Reply objects) with custom properties or methods.

1.  **`'authenticate'`**: This is the **name** of the new property. After this runs, you can access it via `server.authenticate`.
2.  **The `async function`**: This is the **value** (definition). Since it's a function, `server.authenticate` becomes a method you can call.

This is commonly used to share utility functions, database connections, or middleware-like logic (like your authentication check) across your entire application.

Since TypeScript checks types before running, you have to "tell" it that this new method exists. You do this by extending the FastifyInstance interface.

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (...) => Promise<void>; // <--- Telling TS "this method exists"
  }
}
```

In the declaration of the 'authenticate' method, the return type is implicitly `Promise<void>`.

- **`request.jwtVerify()`**:
  - This is the core security check (provided by the `@fastify/jwt` plugin).
  - It looks for a JSON Web Token (JWT) in the request (usually in a Cookie or Authorization header).
  - It checks if the token is valid (signed by your secret) and not expired.

- **Error Handling**:
  - If `jwtVerify()` fails (e.g., no token, fake token, or old token), the code jumps to the `catch` block.
  - It sends a **401 Unauthorized** response back to the user, stopping them from accessing the route.

**How it's used:**
Later in your route files, you can use this as a "pre-handler" hook to protect endpoints:

```typescript
// Example usage in a route
fastify.get(
  '/profile',
  {
    onRequest: [fastify.authenticate], // <--- This uses the function defined above
  },
  async (request, reply) => {
    // This code only runs if the user is logged in!
    return request.user;
  }
);
```

## await server.register(userRoutes, { prefix: '/api/users' });

Registered with prefix: '/api/users'.
This means all routes defined inside userRoutes will start with /api/users.
Example: If userRoutes has a /login route, the full URL is /api/users/login.

Using `await` here ensures that **all your routes are fully loaded and ready** before the server starts listening for requests.

Coming from C, the mental model of `#include` (which literally copies and pastes text before compiling) is very different from how JavaScript works.

In JavaScript/Node.js:

1.  **The `import` (Top of file)**:
    This is somewhat like `#include`. It loads the **definition** of the `userRoutes` function into memory. At this point, the code exists, but it hasn't **run** yet. It's like having a function `void init_users(void)` defined in your code, but not called.

2.  **The `server.register` (The line we are looking at)**:
    This is a **function call**. It is effectively doing this:

    ```typescript
    // conceptually
    userRoutes(server);
    ```

    It passes the `server` instance _into_ that function so `userRoutes` can attach endpoints to it.

3.  **Why `await`? (The Asynchronous part)**:
    In C, functions usually run top-to-bottom and finish.
    In JavaScript servers, the `userRoutes` function is defined as `async`. It might need to do "slow" things during setup (like connecting to a database or reading a config file) before it returns.

    If you don't `await`, the main program says "Okay, I called the function, moving on!" while `userRoutes` is still running in the background. `await` forces the main program to pause until `userRoutes` says "I am completely finished setting up."

---

You MUST mark a function as async if you use the keyword await inside it.

And you MUST use await if you are calling a function that returns a Promise (a "slow" operation) and you need the result before moving to the next line.

Common "Slow" Operations (require await):

Database queries (e.g., db.users.find())  
Network requests (e.g., fetch())  
File system operations (e.g., readFile())  
Password hashing (e.g., bcrypt.hash())

---

# `server.post()`

(In backend/src/user/user.route.ts)  
is a method that tells the server: **"When someone sends a POST request to this URL, run this code."**

It takes 3 arguments:

1.  **The URL Path (`'/'`)**:
    - Where the user sends the request.
    - Combined with the prefix from app.ts, this becomes `/api/users/`.

2.  **The Options Object (`{ schema: ... }`)**:
    - This is the "bouncer" at the door.
    - It checks the ID (Validation) and tells people what's inside (Documentation).
    - If the data sent by the user doesn't match the `body` schema, the server rejects it immediately and never runs the handler.

3.  **The Handler Function (`registerUserHandler`)**:
    - This is the "worker".
    - If the request is valid, this function runs. It does the actual work (saving the user to the database).

**Analogy:**

- **URL**: The address of the building.
- **Options**: The receptionist who checks your paperwork.
- **Handler**: The specialist you actually came to see.

### 1. The Options Object (The "Bouncer")

The options object in Fastify is powerful. It handles **Validation**, **Serialization**, and **Documentation** all at once.

- **`schema.body`**: This defines what the **input** JSON must look like.
  - Example: "Must have an `email` (string, format: email) and `password` (string, minLength: 8)."
  - Fastify uses a library called `Ajv` (Another JSON Validator) under the hood. It compiles this schema into a super-fast validation function.
- **`schema.response`**: This defines what the **output** JSON will look like.
  - Example: "Return `id`, `email`, and `name`, but **exclude** `password`."
  - Fastify uses `fast-json-stringify`. Instead of using generic `JSON.stringify()`, it generates a custom function that is 2x-3x faster because it knows exactly what fields to expect. It also acts as a security filter, ensuring you never accidentally leak private fields.
- **`schema.querystring` / `schema.params`**: (Not used in this specific block, but available) Validates URL parameters (like `?page=2` or `/users/:id`).

`tags: ['Users'],` tells Swagger (the auto-generated API documentation page):
"Put this endpoint inside the 'Users' folder/category."  
When you open http://localhost:3000/docs, you will see a collapsible section named Users. Inside it, you will find this POST / endpoint, along with POST /login, GET /me, etc.  
If you didn't include this, the endpoint would just float at the top of the page in a "default" list, making the documentation harder to read.

The Options object is **not just a schema**. It is a configuration object that _contains_ a `schema` property, but it can hold other things too.

The structure is:

```typescript
{
  // 1. The Schema (Validation & Docs)
  schema: {
    body: ...,
    response: ...
  },

  // 2. Hooks (Run code before/after this specific route)
  onRequest: [server.authenticate], // <--- Example: Check if user is logged in
  preHandler: ...,

  // 3. Configuration (Custom settings for plugins)
  config: {
    rateLimit: { max: 5 } // <--- Example: Limit requests to this route
  },

  // 4. Other settings
  attachValidation: false // <--- Example: Don't stop on error, let me handle it
}
```

In your user.route.ts file:

- The `POST /` route only uses `schema`.
- The `GET /` route (lines 56-68) uses **both** `onRequest` (for auth) and `schema`.

### 2. How does the server reject the request?

If the incoming data does **not** match the `schema.body`:

1.  **Automatic Interception**: Fastify checks the data _before_ your `registerUserHandler` function is ever called.
2.  **Immediate Stop**: If validation fails, Fastify stops processing immediately. Your handler code never runs.
3.  **Error Generation**: Fastify generates a standard error object.
    - **Status Code**: `400 Bad Request`.
    - **Body**: A JSON object describing exactly what is wrong.

    _Example of a default rejection:_

    ```json
    {
      "statusCode": 400,
      "error": "Bad Request",
      "message": "body/email must match pattern \"^...\""
    }
    ```

**Remember the `setErrorHandler` in app.ts?**
That code we looked at earlier intercepts _this specific rejection_. It sees the ugly default message ("body/email must match pattern...") and replaces it with the nice one ("Please enter a valid email address") before sending it to the user.

## async function registerUserHandler(request: FastifyRequest<{ Body: CreateUserInput }>, reply: FastifyReply)

In backend/src/user/user.route.controller.ts.  
The arguments are passed **implicitly** by Fastify when it calls your handler.

When you wrote this in user.route.ts:

```typescript
server.post('/', ..., registerUserHandler);
```

Fastify internally does something like this when a request comes in:

```typescript
// Fastify internal code
const request = new Request(...);
const reply = new Reply(...);

// It calls YOUR function with these two arguments
await registerUserHandler(request, reply);
```

So your function signature MUST match what Fastify expects:

```typescript
export async function registerUserHandler(
  request: FastifyRequest<...>, // Argument 1: The incoming request
  reply: FastifyReply           // Argument 2: The tool to send the response
) { ... }
```

### request: FastifyRequest<{ Body: CreateUserInput }>

This is a **TypeScript Generic**. It is a way to tell TypeScript exactly what shape the data inside `request` has.

- **`FastifyRequest`**: This is the standard type for an incoming request. By default, it doesn't know what's in the body (it assumes `unknown`).
- **`<{ Body: CreateUserInput }>`**: This is the "configuration" for the generic.
  - It says: "Hey TypeScript, for _this specific request_, the `request.body` property will match the `CreateUserInput` type."

**Why do we do this?**
So that when you type `request.body.` later in the code, your editor (VS Code) can autocomplete fields like `.email`, `.password`, and `.alias`. If you try to access `request.body.phoneNumber`, TypeScript will yell at you because `CreateUserInput` doesn't have that field.

It makes your code safer and easier to write.  
??? (Didn't really understand..)

---

## schema

In the context of programming and data, a **Schema** is essentially a **blueprint** or a **rulebook** for your data.

It defines the **structure**, **shape**, and **constraints** of what your data _must_ look like.

### Synonyms & Analogies

To help you grasp it, you can think of a "Schema" as:

- **A Blueprint:** Just as a blueprint tells a builder where the walls and windows go, a schema tells the program: "This object must have an `email` field, and it must be a string."
- **A Mold / Cookie Cutter:** If you try to pour data into your application that doesn't fit the mold (the schema), it gets rejected.
- **A Contract:** It is an agreement between the frontend and backend. "I promise to send you data that looks exactly like this."
- **A Filter:** It looks at incoming data and says, "You are allowed in," or "You are missing a password, go away."

### In your specific file (`user.schema.ts`)

When you define `createUserSchema`, you are creating a strict definition that says:

> "A valid User Creation Request **MUST** be an object containing an `email` (which must look like an email address) and a `password` (which must be at least 8 characters)."

If the data doesn't match this **Schema**, the code throws an error before it even tries to process it.

---

## src/modules/user.schema.ts

This file is a **Schema Definition** file using a library called **Zod**. It serves as the "single source of truth" for your data structures, handling validation, type safety, and documentation all in one place.

Here is a breakdown of the exported items and how to use them:

### 1. The Zod Schemas (`createUserSchema`, `loginSchema`, etc.)

These are the actual validation rules. They define what valid data looks like (e.g., "email must be a valid email", "password must be min 8 chars").

**Usage:**
You mostly use these to derive the other two types of exports, but you can also use them for manual validation in your code if needed.

```typescript
// Example of manual validation (rarely needed in Fastify if you use the JSON schemas)
const result = createUserSchema.safeParse(someData);
if (!result.success) {
  console.error(result.error);
}
```

### 2. The TypeScript Types (`CreateUserInput`, `LoginInput`, etc.)

These are **Type Aliases** automatically inferred from your Zod schemas. They ensure your code knows exactly what the data looks like at compile time.

**Usage:**
You use these in your **Controllers** to type-check the request body.

_Example from user.controller.ts:_

```typescript
import { CreateUserInput } from './user.schema';

export async function registerUserHandler(
  // This tells TS: "request.body will match the CreateUserInput structure"
  request: FastifyRequest<{ Body: CreateUserInput }>,
  reply: FastifyReply
) {
  const { email, password } = request.body; // Typed correctly!
}
```

### 3. The JSON Schemas (`createUserJsonSchema`, etc.)

These are **JSON Schema** objects generated from Zod. Fastify (and other frameworks) use these standard JSON objects for high-performance validation and to generate Swagger/OpenAPI documentation.

**Usage:**
You use these in your **Routes** to tell Fastify how to validate incoming requests and document responses.

_Example from user.route.ts:_

```typescript
import { createUserJsonSchema, userResponseJsonSchema } from './user.schema';

server.post(
  '/',
  {
    schema: {
      body: createUserJsonSchema, // Fastify validates the body against this
      response: {
        201: userResponseJsonSchema, // Fastify documents/serializes the response with this
      },
    },
  },
  registerUserHandler
);
```

### Summary Table

| Export Name            | Type            | Purpose                   | Where to use                             |
| :--------------------- | :-------------- | :------------------------ | :--------------------------------------- |
| `createUserSchema`     | **Zod Schema**  | The logic rules           | To generate the other two                |
| `CreateUserInput`      | **TS Type**     | Compile-time safety       | **Controllers** (e.g., `request.body`)   |
| `createUserJsonSchema` | **JSON Object** | Runtime validation & Docs | **Routes** (passed to `schema: { ... }`) |

### Inference (en français; déduction)

In this context, **"inferred"** means that TypeScript **automatically figures out** the type definition for you based on the code you already wrote, so you don't have to write it twice.

Without inference, you would have to update two places every time you changed a field:

1.  **The Validator (Runtime):** `z.string().min(5)`
2.  **The Type (Compile time):** `username: string`

With **inference** (`z.infer<...>`), you write the validator once, and TypeScript "looks at" that code and generates the equivalent type definition automatically.

### Example

**1. You write the Schema (The "Source of Truth"):**

```typescript
const UserSchema = z.object({
  username: z.string(),
  age: z.number(),
});
```

**2. TypeScript "Infers" the Type:**
When you use `z.infer<typeof UserSchema>`, TypeScript analyzes the code above and essentially writes this for you in the background:

```typescript
// You don't write this manually! TypeScript generates it.
type User = {
  username: string;
  age: number;
};
```

If you later change `age: z.number()` to `age: z.string()`, the inferred type automatically updates to `string` instantly. This prevents bugs where your validation logic and your type definitions get out of sync.

### Examples

`createUserSchema` is used in three key places in your backend:

### 1. In the Controller (Manual Validation)

It is used inside `registerUserHandler` to validate the incoming data and ensure it matches the rules (email format, password length, etc.).

user.controller.ts

```typescript
// ... inside registerUserHandler
// Validate input with Zod
const validatedData = createUserSchema.parse(request.body);
```

### 2. In the Route Definition (Indirectly)

It is converted to `createUserJsonSchema` and passed to Fastify. This tells Fastify to automatically validate requests _before_ they even reach your controller, and to generate the Swagger API documentation.

user.route.ts

```typescript
server.post(
  '/',
  {
    schema: {
      // ...
      body: createUserJsonSchema, // <--- Derived from createUserSchema
      // ...
    },
  },
  registerUserHandler
);
```

### 3. In the Schema File itself (Type Inference)

It is used to generate the TypeScript type `CreateUserInput`. This ensures that your code knows exactly what fields exist on the user object (like `email` and `password`) so you get autocomplete and type checking.

```typescript
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

---

# Database

The database initialization in this project is primarily handled by **Prisma** (an ORM) and a shell script. Here is a breakdown of how the pieces fit together:

### 1. The Database Structure (Schema)

The blueprint for your database is defined in schema.prisma.

- **File:** schema.prisma
- **What it does:** It tells Prisma to use **SQLite** as the database provider and defines your data models (tables). Currently, it defines a `User` model with fields like `email`, `alias`, and `password`.

### 2. The Initialization Script

There is a shell script that orchestrates the setup.

- **File:** init-db.sh
- **What it does:**
  1. Checks if the database file already exists.
  2. **If not, it runs `npx prisma migrate dev` to create the database tables based on your schema.**
  3. Then it runs `npx prisma db seed` to fill it with initial data.

### 3. Seeding Data (The "Seed" Script)

This is the JavaScript/TypeScript code that actually inserts the initial data.

- **File:** seed.ts
- **What it does:**
  - It connects to the database using the Prisma Client.
  - It defines a list of `demoUsers` (Alice, Bob, Charlie, Demo).
  - It loops through them and creates them in the database if they don't already exist.
  - It uses a helper `hashPassword` to secure passwords before saving them.

### 4. Connecting to the Database

The application code connects to the database using a shared instance of the Prisma Client.

- **File:** prisma.ts
- **What it does:** It initializes the `PrismaClient` once and exports it so other parts of the backend can import it to query the database.

### How to Run It

You can use the Makefile commands to manage the database easily:

- **Initialize:** `make db-init` (Runs the shell script to set up everything)
- **Reset:** `make migrate-reset` (Deletes all data and re-creates tables)
- **Seed only:** `make seed` (Runs just the seed script)

This setup allows you to get a fully working database with test users just by running `make db-init`.

## Examples of reading/writing to the database

It loops through the list of users provided.  
Check: It asks the database, "Does a user with this email already exist?"  
Skip: If yes, it skips them to avoid duplicates or errors.  
Create: If no, it hashes the password (turns password123 into a secure string like $argon2id$v=19...) and saves the new user to the database.

```typescript
// import...

const adapter = new PrismaBetterSqlite3({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

//...

async function seedUsers(users: typeof demoUsers) {
  console.log(`📦 Seeding ${users.length} users...`);

  for (const user of users) {
    const existingUser = await prisma.user.findUnique({
      // Reading from DB
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`  ⏭️  User ${user.email} already exists, skipping`);
      continue;
    }

    const hashedPassword = await hashPassword(user.password);

    await prisma.user.create({
      // Writing to DB
      data: {
        email: user.email,
        alias: user.alias,
        password: hashedPassword,
      },
    });

    console.log(`  ✅ Created user: ${user.alias} (${user.email})`);
  }
}
```

The variable 'prisma' is the tool (specifically an ORM - Object Relational Mapper) that lets your JavaScript code talk to the database. (SQLite is the actual database where the data is stored, in the file database.db)  
'user' is a table defined in schema.prisma.  
Prisma enforces a specific naming convention that changes between the schema file and your code.

- **In schema.prisma (The Definition):**
  Models are defined using **PascalCase** (Capitalized).

  ```prisma
  model User {      // Capital 'U'
    id String @id
    ...
  }
  ```

- **In seed.ts / JavaScript Code (The Usage):**
  When Prisma generates the client for your code, it automatically converts the model name to **camelCase** (lowercase start). This is standard JavaScript practice.
  ```typescript
  // In your code, you must use lowercase 'user'
  await prisma.user.findMany();
  ```

**Summary:**

- Define it as **`User`** in the schema.
- Use it as **`prisma.user`** in your code.
- If you had a model named `BlogPost`, you would access it as `prisma.blogPost`.

## Database structure and API validation rules

- **`schema.prisma`**: Defines your **Database Structure** (Tables, Columns, Relationships). It tells the database how to _store_ the data permanently.
- **user.schema.ts**: Defines your **API Validation Rules** (Blueprints). It tells the server how to _check_ the data coming from the user (frontend) before it even touches the database.

### Why do we need both?

Because the "shape" of data you **receive** is often different from the "shape" of data you **store**.

**Example:**

1.  **Incoming Data (user.schema.ts)**:
    - User sends: `{ email: "...", password: "plain_text_password", confirmPassword: "..." }`
    - _Validation:_ Check if passwords match, check if email is valid.

2.  **Stored Data (`schema.prisma`)**:
    - Database stores: `{ id: 1, email: "...", passwordHash: "hashed_secret_string", createdAt: ... }`
    - _Storage:_ We don't store `confirmPassword`. We don't store the plain text password. We generate an `id` and `createdAt` automatically.

So, user.schema.ts is the "Bouncer" at the door checking IDs, and `schema.prisma` is the "Architect" who built the club inside.

## Example

Here is the step-by-step flow of a "Register User" request, showing how the **Route**, **Schema**, and **Handler** work together.

### 0: The Frontend (The Customer)

The user fills out a form on your website (e.g., `register.ts` in your frontend folder) and clicks "Sign Up".
The frontend code (using `fetch` or `axios`) packages that data into a JSON parcel and sends it to your server's address: `POST /api/users/`.

### The Two Ways to Send Data

**A. The Old School Way (Browser Default)**
If you have a plain HTML form:

```html
<form action="/api/users" method="POST">
  <input name="email" />
  <button type="submit">Send</button>
</form>
```

- **What happens:** The browser takes the data, navigates away from the current page, and loads the response from the server as a new page.
- **Is this you?** Probably not. This causes a full page refresh.

**B. The Modern Way (JavaScript/AJAX)**
This is what you are likely doing in register.ts.

```typescript
// You prevent the default browser behavior
form.addEventListener('submit', async (e) => {
  e.preventDefault(); // <--- STOP the browser from reloading the page!

  // You manually grab the data
  const data = {
    email: emailInput.value,
    password: passwordInput.value,
  };

  // You manually send it using code
  await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
});
```

- **What happens:** The page stays open. Your JavaScript sends the data silently in the background. When the answer comes back, you update the screen (e.g., show a "Success!" message) without reloading.

So, while the `<form>` element exists in your HTML, your **JavaScript code** intercepts the submission and builds the POST request manually.

The body is a **JSON string**.

Here is what the raw HTTP request looks like "on the wire" (what the server actually sees):

```http
POST /api/users/ HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 86

{"email":"alice@example.com","password":"supersecretpassword","alias":"Alice"}
```

### Breakdown:

1.  **`POST /api/users/ HTTP/1.1`**: The Method (POST) and the Path.
2.  **`Content-Type: application/json`**: Tells the server "The blob of text below is JSON, please parse it accordingly."
3.  **`Content-Length: 86`**: The size of the body in bytes.
4.  **`{"email":...}`**: The Body. This is the result of `JSON.stringify(data)`. It is just plain text formatted as JSON.

### Backend. 1. The Setup (The Route)

In user.route.ts, you are defining the rules of engagement.

```typescript
server.post(
  '/',
  {
    schema: {
      body: createUserJsonSchema, // <--- The Rulebook
      response: {
        201: userResponseJsonSchema, // <--- The Output Filter
      },
    },
  },
  registerUserHandler
); // <--- The Worker
```

- **The Rulebook:** You tell Fastify, "Before you even bother the `registerUserHandler`, check if the request body matches `createUserJsonSchema`."
- **The Worker:** If the rules are met, pass the data to `registerUserHandler`.

### 2. Scenario A: The Invalid Request (The Bouncer)

A user sends this data:

```json
{ "email": "not-an-email", "password": "123" }
```

1.  **Fastify (The Bouncer)** intercepts the request.
2.  It looks at `createUserJsonSchema`.
3.  It sees the email is invalid and the password is too short.
4.  **Action:** It rejects the request immediately.
5.  **Result:** `registerUserHandler` is **NEVER CALLED**. The code inside your controller doesn't even run. The user gets a `400 Bad Request` error instantly.

### 3. Scenario B: The Valid Request (The Worker)

A user sends this data:

```json
{ "email": "alice@example.com", "password": "supersecretpassword", "alias": "Alice" }
```

1.  **Fastify** checks the schema. Everything looks good.
2.  **Action:** It calls `registerUserHandler(request, reply)`.
3.  **Inside the Handler (user.controller.ts):**
    - It receives the clean data.
    - It calls your database (Prisma) to check if "alice@example.com" already exists.
    - It saves the new user to the database.
    - It returns the user object: `{ id: 1, email: "...", password: "...", ... }`

### 4. The Exit (The Output Filter)

Your handler returns the user object. But wait! That object might contain sensitive fields (like internal flags or password hashes) if you aren't careful.

1.  **Fastify** looks at the `response` schema: `userResponseJsonSchema`.
2.  It takes the object returned by the handler and **filters it**.
3.  It ensures only the fields defined in the response schema (`id`, `email`, `alias`, `createdAt`) are sent back to the user.
4.  **Result:** The user receives a clean, safe JSON response.

---

```typescript
// Route registration
server.get(
  '/api/game/ws',
  {
    websocket: true,
    // Fastify will call this function before it continues to upgrade to WebSocket
    preValidation: async (request, reply) => {
      const auth = await verifyTokenFromCookie(request);
      if (!auth) return reply.code(401).send({ error: 'Authentication required' });
      request.wsAuth = auth; // available later in handler
    },
  },
  (socket, request) => {
    // Only runs after preValidation succeeded and upgrade completed
  }
);
```

---

## Interface

## What is an interface? 💡

An **interface** is a TypeScript compile-time construct that describes the _shape_ of an object (properties and their types), function signatures, or a contract a class can implement. It does not exist at runtime — it’s used by the compiler to check types.

---

## Why use interfaces? ✅

- Enforce consistent object shapes across code (parameters/returns, events, DTOs).
- Make APIs self-documenting.
- Let classes declare they implement a contract (`implements`).
- Enable safer refactors and better editor/autocomplete support.

### Basic syntax — example

```ts
interface User {
  id: string;
  name: string;
  age?: number; // optional
}

function greet(user: User) {
  console.log(`Hello ${user.name}`);
}
```

### Advanced usage

- Extend interfaces:

```ts
interface Animal {
  species: string;
}
interface Dog extends Animal {
  bark: () => void;
}
```

- Index signatures:

```ts
interface StringMap {
  [key: string]: string;
}
```

- Use with generics and keyof to strongly type event systems:

```ts
interface ClientEvents {
  'player:input': { direction: 'up' | 'down' | 'none' };
  'match:create': { mode: '1v1' | 'tournament' };
}

// Handler helper:
function on<E extends keyof ClientEvents>(event: E, handler: (data: ClientEvents[E]) => void) {
  /* ... */
}
```

### Interface vs type (short)

- Both can describe object shapes.
- `interface` supports declaration merging and `extends`; `type` is more flexible (unions, intersections).
- Prefer `interface` for public object contracts and `type` for unions/complex aliases.

---

> Tip: Use interfaces for your WebSocket event payloads (like `ClientEvents`) so handlers and senders stay perfectly typed and consistent across frontend/backend. ✅
