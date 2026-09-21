# FairPlay — Badminton & Pickleball Rotation & Session Manager

FairPlay is a tournament and open play rotation manager designed for badminton, pickleball, and racket sport clubs. It provides algorithmic fair rotations, queue management, court scheduling, and live score tracking with seamless session sharing.

## Local Runtime Storage & Security Notice

> **IMPORTANT:**
> `.data/sessions.json` is used for local server runtime persistence. It stores active session state, player names, queue buckets, match histories, and organizer tokens.
>
> - `.data/` is strictly listed in `.gitignore` and **must never be committed** to version control, as it contains live user and match data.
> - The server (`server.ts`) automatically creates the `.data/` directory and `sessions.json` file if they do not exist on startup.
> - **Security Advisory on Git History**: If `.data/sessions.json` was previously committed to a public git repository, all session codes, player rosters, and organizer tokens recorded in past commit snapshots should be treated as exposed. Repository owners should purge the file from git history (e.g. using `git filter-repo` or BFG Repo-Cleaner) or retire any exposed session codes.

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```
