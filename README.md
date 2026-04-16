# Tether

[![Build](https://github.com/saich08/tether/actions/workflows/build.yml/badge.svg)](https://github.com/saich08/tether/actions/workflows/build.yml)
[![Release](https://github.com/saich08/tether/actions/workflows/release.yml/badge.svg)](https://github.com/saich08/tether/actions/workflows/release.yml)

A multi-platform SSH client with an integrated terminal and file explorer. Tether is built on Electron, React, and xterm.js, giving you a native desktop experience for managing remote servers.

## Features

- **SSH connections** — connect to remote hosts with password or key-based authentication, with support for native SSH config files (`~/.ssh/config`)
- **Integrated terminal** — full xterm.js terminal with search, clickable web links, and automatic resizing
- **File explorer** — browse, upload, download, and edit remote files over SFTP without leaving the app
- **Session tabs** — manage multiple simultaneous SSH sessions in a tabbed interface
- **Split pane** — view the terminal and file explorer side-by-side in a resizable split layout
- **Copy/paste support** — native clipboard integration in the terminal
- **Multi-platform** — packaged for Windows (NSIS + Portable installer) and macOS (DMG)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm 9+

## Building

Install dependencies, then build the app:

```bash
npm install
npm run build
```

To run in development mode with hot-reload:

```bash
npm run dev
```

To produce distributable packages for your current platform:

```bash
npm run dist
```

Platform-specific builds:

```bash
npm run dist:win    # Windows (NSIS + Portable installer)
npm run dist:mac    # macOS (DMG)
```

Built artifacts are written to the `dist/` directory.

## Testing

Run the unit test suite:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

Generate a coverage report:

```bash
npm run test:coverage
```

Run end-to-end tests (requires a built app):

```bash
npm run test:e2e
```

Type-check without emitting output:

```bash
npm run typecheck
```

## Releasing

Ensure your working directory is clean and on `main`, then run:

```bash
npm run release
```

The script walks you through the full release flow:

1. Verifies the working directory is clean and you are on `main`
2. Pulls the latest changes from origin
3. Prompts for a new version number (`MAJOR.MINOR.PATCH`)
4. Creates a `release/v<version>` branch, bumps `package.json`, commits, and tags
5. Pushes the release branch to origin
6. Pauses — open a PR from `release/v<version>` → `main` and merge it
7. Press Enter to resume — the script checks out `main`, pulls, and pushes the tag

Pushing the tag triggers the [Release pipeline](https://github.com/saich08/tether/actions/workflows/release.yml), which builds platform artifacts and publishes the GitHub release automatically.
