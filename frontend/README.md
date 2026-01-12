# TypeScript + Vite + Tailwind CSS

This frontend is built with vanilla TypeScript (no frameworks), Vite for bundling, and Tailwind CSS for styling.

## Project Compliance

This project follows the subject requirements: **TypeScript + Tailwind CSS and nothing else**. No React or other frontend frameworks are used.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

## Authentication

### Expected 401 Errors in Dev Tools

When you're **logged out**, you'll see a 401 Unauthorized error in the browser's Network tab:

```
GET /api/users/me [HTTP/1.1 401 Unauthorized]
```

**This is expected behavior, not a bug.** Here's why:

1. On page load, the app calls `isAuthenticated()` to check login status
2. This makes a request to `/api/users/me`
3. The server correctly returns **401 Unauthorized** when there's no valid auth cookie
4. The browser dev tools displays non-2xx responses in red

The code handles this gracefully:

```typescript
// In getCurrentUser()
if (!response.ok) {
  return null; // Returns null, doesn't throw an error
}
```

A 401 response is the proper RESTful way for the server to indicate "you're not authenticated." This is standard practice and can be safely ignored in dev tools when you're not logged in.
