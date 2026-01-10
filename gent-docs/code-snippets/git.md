# Git

## `git fetch origin`

contacts the remote named "origin" and downloads commits, refs (branches/tags) and objects from it into your local repository. It updates your remote-tracking branches (e.g., `origin/main`) but does NOT merge or change your current local branches or working files.

- To integrate the fetched changes into your branch, run `git merge origin/<branch>` (or use `git pull` which does fetch+merge).
- You can fetch a specific branch (`git fetch origin main`) or use `git fetch --prune` to remove deleted remote branches.

## `git checkout -b pr-123 origin/feature/branch-name`

- **Creates a new local branch** named `pr-123` starting at the commit pointed to by `origin/feature/branch-name`.
- **Checks out** (switches to) the new branch `pr-123` so your working tree is on it.
- **Does not** automatically create or update any branch on the remote; it only creates the local branch.
- **Does not** automatically set `pr-123` to track `origin/feature/branch-name` (you can set tracking manually if needed).

### Quick tips

- To push and set upstream in one step:  
  `git push -u origin pr-123`
- To set tracking afterward:  
  `git branch --set-upstream-to=origin/feature/branch-name pr-123`

> Note: `origin/feature/branch-name` is a remote-tracking branch (your local copy of the remote branch), so you’re basing `pr-123` on the remote state at fetch time.

## Tracking

- **Tracking** (aka _having an upstream_) means a local branch is configured to follow a specific remote branch (e.g., `origin/feature/branch-name`).
- When a branch **tracks** another, Git uses that upstream by default for commands like `git pull`, `git push`, and to show "ahead/behind" in `git status`.
- You can see tracking info with: `git branch -vv` (it shows the upstream for each local branch).

> Note: creating a branch with `git checkout -b pr-123 origin/feature/branch-name` sets the starting point to the remote-tracking ref, but it does **not** configure `pr-123` to track that remote branch automatically.

- `git push -u origin pr-123` pushes your local `pr-123` to `origin` and **sets the remote branch created/used as the upstream** for your local branch.
- After that, `git push` and `git pull` (no args) will default to that upstream, and `git status` will compare to it automatically.

Useful alternate: to make a local branch track an existing remote branch explicitly:

- `git branch --set-upstream-to=origin/feature/branch-name pr-123`

## Origin

Origin is the default alias (nickname) Git assigns to the server from which you cloned the project.  
Core Concepts:

- Remote: A version of your project hosted on the internet or a network (GitHub, GitLab, Bitbucket).
- Origin: Instead of typing the full URL (e.g., https://github.com/user/repo.git) every time, you use the shorthand name origin.

How it is Created:

- Cloning: When you run git clone <URL>, Git automatically sets up the connection and names it origin.
- Manual: If you start a local project and link it to GitHub later, you typically run: git remote add origin <URL>

To see the URL your origin points to, run:

```bash
git remote -v
```

## `git fetch origin pull/123/head:pr-123`

- `origin` = remote name.
- `pull/123/head` = a remote ref GitHub exposes (under refs/pull/123/head) that points to the PR’s HEAD commit.
  Important: `pull` here is not a local branch name or git keyword you typed—it's part of the ref path that GitHub provides.
- `:pr-123` means “write the fetched ref to a new local branch named pr-123”.

When to use: the branch name is unknown or you prefer to fetch the PR’s HEAD directly; works even if the repo owner keeps PR branches in a different fork.
