Start with these tables
users

Holds the canonical account. Works for local login and Google sign-in.

id INTEGER PK

alias TEXT NOT NULL -- display name in games

username TEXT UNIQUE -- optional if you only use alias; keep UNIQUE if used

email TEXT UNIQUE -- can be NULL for OAuth-only until verified

password_hash TEXT -- NULL for OAuth-only users

avatar_url TEXT

created_at DATETIME NOT NULL

updated_at DATETIME NOT NULL

last_seen_at DATETIME -- for presence

is_online INTEGER -- optional; better to derive from last_seen_at/WS, see note

Notes

Store only a strong password_hash (bcrypt/argon2). No plain passwords.

For presence, prefer computing “online” from a short TTL heartbeat (e.g., Redis) and only persist last_seen_at in DB.

auth_accounts (for Google OAuth 2.0)

Links a user to external identity providers. Supports multiple providers if you add more later.

id INTEGER PK

user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE

provider TEXT NOT NULL -- e.g., 'google'

provider_user_id TEXT NOT NULL -- Google “sub” claim

email TEXT -- email from provider at signup time

email_verified INTEGER NOT NULL DEFAULT 0

access_token TEXT -- usually avoid storing; use short-lived and keep in memory

refresh_token TEXT -- store only if you need offline access (encrypt at rest)

scopes TEXT -- optional

created_at DATETIME NOT NULL

updated_at DATETIME NOT NULL

UNIQUE(provider, provider_user_id)

What to keep for Google

Always keep provider, provider_user_id (sub), and whether email is verified.

You do not need to store ID tokens; you verify them server-side and discard.

Only store refresh_token if you need to call Google APIs when the user is offline; encrypt it.

user_friends (friend graph)

user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE

friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE

status TEXT NOT NULL -- 'pending' | 'accepted' | 'blocked'

created_at DATETIME NOT NULL

PRIMARY KEY(user_id,friend_user_id)

matches (1v1 games; can later link to tournaments)

id INTEGER PK

played_at DATETIME NOT NULL

tournament_id INTEGER -- NULL if casual; add FK when you add tournaments table

tx_hash TEXT -- blockchain transaction storing score (optional but handy)

network TEXT -- e.g., 'fuji' | 'avalanche'

created_at DATETIME NOT NULL

match_players (participants + scores; two rows per match)

match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE

user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE

alias_snapshot TEXT NOT NULL -- store alias used AT MATCH TIME

score INTEGER NOT NULL

is_winner INTEGER NOT NULL

PRIMARY KEY(match_id,user_id)

user_stats (optional, denormalized for speed)

You can always compute wins/losses from match_players, but a cached table helps.

user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE

wins INTEGER NOT NULL DEFAULT 0

losses INTEGER NOT NULL DEFAULT 0

updated_at DATETIME NOT NULL

Keep it as a materialized cache you update via triggers/jobs, or recompute on demand at first.

Minimal tournament scaffolding (add later)

When you’re ready:

tournaments

id INTEGER PK

name TEXT NOT NULL

started_at DATETIME

ended_at DATETIME

tournament_participants

tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE

user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE

PRIMARY KEY(tournament_id,user_id)

Then set matches.tournament_id as FK.

Indices you’ll want early

users(email) UNIQUE

users(username) UNIQUE (if using)

auth_accounts(provider, provider_user_id) UNIQUE

match_players(user_id) (for user history pages)

matches(played_at) (for recency queries)

matches(tx_hash) (quick link to on-chain record)

Do you need to keep anything for OAuth in DB?

Yes, minimally:

A users row you control (your app’s identity).

An auth_accounts row: provider, provider_user_id (sub), email_verified, timestamps.

Optionally email and avatar_url snapshot from Google profile.

No, you don’t need:

To store Google ID tokens permanently.

To store access tokens unless you actually call Google APIs later.

To store “online status” as a boolean—prefer last_seen_at + real-time presence.

Security & privacy tips (important for evaluation)

Hash passwords with Argon2id or bcrypt; never store plain passwords.

Encrypt any stored refresh_token (if you must keep it).

Keep all secrets in .env (and git-ignored).

Record tx_hash for each on-chain score write so users can verify on Snowtrace.

tiny SQLite DDL starter (copy/paste & iterate)
CREATE TABLE users (
id INTEGER PRIMARY KEY,
alias TEXT NOT NULL,
username TEXT UNIQUE,
email TEXT UNIQUE,
password_hash TEXT,
avatar_url TEXT,
created_at DATETIME NOT NULL,
updated_at DATETIME NOT NULL,
last_seen_at DATETIME,
is_online INTEGER
);

CREATE TABLE auth_accounts (
id INTEGER PRIMARY KEY,
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
provider TEXT NOT NULL,
provider_user_id TEXT NOT NULL,
email TEXT,
email_verified INTEGER NOT NULL DEFAULT 0,
access_token TEXT,
refresh_token TEXT,
scopes TEXT,
created_at DATETIME NOT NULL,
updated_at DATETIME NOT NULL,
UNIQUE(provider, provider_user_id)
);

CREATE TABLE user_friends (
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
status TEXT NOT NULL,
created_at DATETIME NOT NULL,
PRIMARY KEY(user_id, friend_user_id)
);

CREATE TABLE matches (
id INTEGER PRIMARY KEY,
played_at DATETIME NOT NULL,
tournament_id INTEGER,
tx_hash TEXT,
network TEXT,
created_at DATETIME NOT NULL
);

CREATE TABLE match_players (
match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
alias_snapshot TEXT NOT NULL,
score INTEGER NOT NULL,
is_winner INTEGER NOT NULL,
PRIMARY KEY(match_id, user_id)
);

CREATE TABLE user_stats (
user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
wins INTEGER NOT NULL DEFAULT 0,
losses INTEGER NOT NULL DEFAULT 0,
updated_at DATETIME NOT NULL
);
