# Two-Factor Authentication (2FA) Implementation Plan

## Overview

Implement TOTP-based Two-Factor Authentication using Google Authenticator (or any TOTP app like Authy, Microsoft Authenticator).

**Module:** Major module - "Implement Two-Factor Authentication (2FA) and JWT"

**Status:** Planning complete, ready for implementation

---

## Tech Stack

### Libraries

```bash
# Backend - TOTP verification + encryption
pnpm add otpauth qrcode --filter backend
pnpm add -D @types/qrcode --filter backend
```

- **otpauth**: Pure JS TOTP library, works with Google Authenticator
- **qrcode**: Generate QR codes for authenticator app scanning
- **crypto** (built-in): AES-256-GCM encryption for TOTP secrets

---

## Environment Variables

Add to `.env` files:

```bash
# Two-Factor Authentication encryption key (32 bytes hex = 64 chars)
# Generate with: openssl rand -hex 32
TWO_FACTOR_ENCRYPTION_KEY=your-64-char-hex-key-here
```

---

## Database Schema Changes

Add to `User` model in `backend/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  alias     String   @unique
  password  String?
  googleId  String?  @unique

  // 2FA fields (NEW)
  twoFactorSecret   String?           // TOTP secret (AES-256-GCM encrypted)
  twoFactorEnabled  Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## API Endpoints

### New 2FA Module (`/api/2fa`)

| Method | Endpoint           | Description                    | Auth         |
| ------ | ------------------ | ------------------------------ | ------------ |
| POST   | `/api/2fa/setup`   | Generate TOTP secret + QR code | JWT Required |
| POST   | `/api/2fa/enable`  | Verify code & enable 2FA       | JWT Required |
| POST   | `/api/2fa/disable` | Disable 2FA                    | JWT Required |
| POST   | `/api/2fa/verify`  | Verify 2FA code during login   | Temp Token   |

### Modified User Endpoints

| Method | Endpoint           | Change                                                   |
| ------ | ------------------ | -------------------------------------------------------- |
| POST   | `/api/users/login` | Return `{ requires2FA: true, tempToken }` if 2FA enabled |
| GET    | `/api/users/me`    | Include `twoFactorEnabled` in response                   |

---

## Authentication Flows

### Current Flow (Without 2FA)

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Enter credentials -->|                          |
  |                        |-- POST /login ---------->|
  |                        |<-- JWT cookie -----------|
  |<-- Redirect home ------|                          |
```

### New Flow (With 2FA Enabled)

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Enter credentials -->|                          |
  |                        |-- POST /login ---------->|
  |                        |<-- { requires2FA: true,  |
  |                        |      tempToken: "..." } -|
  |<-- Show 2FA input -----|                          |
  |-- Enter 6-digit code ->|                          |
  |                        |-- POST /2fa/verify ----->|
  |                        |   { tempToken, code }    |
  |                        |<-- JWT cookie -----------|
  |<-- Redirect home ------|                          |
```

### 2FA Setup Flow

```
User                    Frontend                   Backend
  |                        |                          |
  |-- Go to Settings ----->|                          |
  |-- Click "Enable 2FA" ->|                          |
  |                        |-- POST /2fa/setup ------>|
  |                        |<-- { secret, qrCodeUrl }-|
  |<-- Show QR code -------|                          |
  |-- Scan with app ------>|                          |
  |-- Enter code --------->|                          |
  |                        |-- POST /2fa/enable ----->|
  |                        |   { code: "123456" }     |
  |                        |<-- { success: true } ----|
  |<-- "2FA Enabled!" -----|                          |
```

---

## File Structure

### Backend (New Files)

```
backend/src/
├── modules/2fa/
│   ├── 2fa.controller.ts    # Request handlers
│   ├── 2fa.route.ts         # Route definitions
│   ├── 2fa.schema.ts        # Zod schemas + JSON schemas
│   └── 2fa.service.ts       # TOTP generation/verification logic
└── utils/
    └── crypto.ts            # AES-256-GCM encryption helpers
```

### Backend (Modified Files)

```
backend/
├── prisma/schema.prisma           # Add 2FA fields
├── src/app.ts                     # Register 2FA routes
├── src/modules/user/
│   ├── user.controller.ts         # Update login handler
│   ├── user.schema.ts             # Update response schemas
│   └── user.service.ts            # Add 2FA field queries
```

### Frontend (New Files)

```
frontend/src/
├── pages/settings.ts              # 2FA setup UI
└── components/2fa-modal.ts        # 2FA verification modal (login)
```

### Frontend (Modified Files)

```
frontend/src/
├── pages/login.ts                 # Handle requires2FA response
├── utils/auth.ts                  # Update login function
└── main.ts                        # Add settings route
```

---

## Implementation Details

### Temp Token Strategy

When user has 2FA enabled and provides correct password:

1. Backend generates short-lived temp token (5 min expiry)
2. Temp token contains: `{ userId, type: '2fa-pending' }`
3. Temp token is NOT a full JWT - cannot access protected routes
4. After 2FA verification, real JWT cookie is set

```typescript
// Temp token payload
interface TempTokenPayload {
  userId: string;
  type: '2fa-pending';
  exp: number; // 5 minutes
}
```

### TOTP Configuration

```typescript
const totp = new TOTP({
  issuer: 'ft_transcendence',
  label: user.email,
  algorithm: 'SHA1',
  digits: 6,
  period: 30, // 30 seconds
});
```

### Verification Window

Allow ±1 period (30 seconds) to account for clock drift:

```typescript
totp.validate({ token: code, window: 1 });
```

---

## Response Schemas

### Login Response (Updated)

```typescript
// Without 2FA or 2FA disabled
{ success: true }  // + JWT cookie

// With 2FA enabled
{
  requires2FA: true,
  tempToken: "eyJ..."
}
```

### GET /users/me Response (Updated)

```typescript
{
  id: string,
  email: string,
  alias: string,
  twoFactorEnabled: boolean,  // NEW
  createdAt: string
}
```

### POST /2fa/setup Response

```typescript
{
  secret: string,      // Base32 secret (for manual entry)
  qrCodeDataUrl: string // Data URL for QR code image
}
```

### POST /2fa/enable Request

```typescript
{
  code: string; // 6-digit TOTP code
}
```

### POST /2fa/verify Request

```typescript
{
  tempToken: string,  // From login response
  code: string        // 6-digit TOTP code
}
```

---

## Security Considerations

1. **Secret Storage**: Encrypt TOTP secret at rest using AES-256-GCM
   - Encryption key stored in environment variable (`TWO_FACTOR_ENCRYPTION_KEY`)
   - If DB leaks but env vars are safe, secrets remain protected
   - Each secret has unique IV (initialization vector)
2. **Temp Token**: Short-lived (5 min), single purpose, cannot access protected routes
3. **Rate Limiting**: Limit 2FA verification attempts (handled by existing rate limiter)
4. **Clock Drift**: Allow ±30 second window for code validation

---

## Encryption Implementation

### AES-256-GCM Helper (`backend/src/utils/crypto.ts`)

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

## Implementation Order

### Phase 1: Backend Foundation

1. [ ] Update Prisma schema with 2FA fields
2. [ ] Run database migration
3. [ ] Install `otpauth` and `qrcode` packages
4. [ ] Create `crypto.ts` - AES-256 encryption helpers
5. [ ] Add `TWO_FACTOR_ENCRYPTION_KEY` to `.env` files

### Phase 2: 2FA Module

6. [ ] Create `2fa.service.ts` - TOTP helpers (with encryption)
7. [ ] Create `2fa.schema.ts` - Zod schemas
8. [ ] Create `2fa.controller.ts` - Handlers
9. [ ] Create `2fa.route.ts` - Routes
10. [ ] Register routes in `app.ts`

### Phase 3: Login Integration

11. [ ] Update `user.controller.ts` - Login with 2FA check
12. [ ] Update `user.schema.ts` - Login response schema

### Phase 4: Frontend - Settings

13. [ ] Create settings page with 2FA setup UI
14. [ ] Add QR code display
15. [ ] Add enable/disable functionality

### Phase 5: Frontend - Login

16. [ ] Update login page for 2FA flow
17. [ ] Create 2FA code input modal/form
18. [ ] Update `auth.ts` utility

### Phase 6: Testing

19. [ ] Backend unit tests for 2FA module
20. [ ] Backend integration tests for login flow
21. [ ] Frontend tests for 2FA UI

---

## Google Cloud Console

**No changes needed!**

TOTP (Time-based One-Time Password) is a local algorithm:

- Google Authenticator is just an app that implements TOTP
- No Google API calls are made
- Works completely offline
- Any TOTP app works (Authy, Microsoft Authenticator, etc.)

---

## Notes

- **No backup codes** - Keeping implementation simple
- **2FA is OFF by default** - Users enable in settings after registration
- **OAuth users can enable 2FA** - Works with Google login too
- **Disable doesn't require code** - User already proved identity via current JWT
