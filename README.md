# ReadAlong

ReadAlong is a browser-based EPUB reader built with React, Vite, and TanStack Router. It lets users import EPUB files, read them in a clean focused layout, and listen to text with the browser's built-in text-to-speech support.

The app is designed to feel lightweight and personal:

- Import EPUB books directly in the browser
- Track reading progress and reopen books where you left off
- Read in either sentence-based or paragraph-based layout
- Adjust font size, line spacing, reading speed, theme, highlight style, and voice
- Add bookmarks and notes while reading
- Store books, settings, progress, bookmarks, and notes locally on the device

## How It Works

ReadAlong extracts readable text from EPUB files, converts it into a simplified reading view, and plays speech using the browser's `speechSynthesis` API.

Important behavior to know:

- Voices come from the user's device or browser
- Available voices can differ between desktop, Android, and iPhone/iPad
- Imported books and reading data are stored locally in the browser, not on a server
- If a saved voice is no longer available, the app falls back to a valid available voice

## Project Stack

- React 19
- TypeScript
- Vite
- TanStack Router / TanStack Start
- Tailwind CSS
- `@intity/epub-js` for EPUB parsing

## Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Vite will print the local development URL in the terminal, usually `http://localhost:5173`.

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## Available Scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run format
```

## How To Use The App

### Import a book

1. Open the home page.
2. Click `Open EPUB` or use the upload area.
3. Select an `.epub` file from your device.

### Start reading

1. Open a book from the home page or library.
2. Use the reader controls to move forward or backward.
3. Press play to start text-to-speech.

### Change reading settings

1. Open `Settings`.
2. Adjust:
   - font size
   - line spacing
   - reading layout (`Line sentences` or `Paragraphs`)
   - highlight style
   - theme
   - voice
   - playback speed

### Save your place

The app automatically remembers:

- the current book
- reading progress
- active page or line
- bookmarks
- notes
- reader settings

## Storage

This project currently uses browser storage for persistence. That means:

- data stays on the same browser and device
- clearing site data or browser storage can remove imported books and reading history
- there is no account sync or cloud backup yet

## GitHub Pages Deployment

This repository is configured for GitHub Pages deployment through GitHub Actions.

### Live project

```text
https://myk-francis.github.io/read-flow-state/
```

### One-time GitHub setup

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings > Pages`.
4. Under `Source`, choose `GitHub Actions`.

### Deployment flow

- The workflow file is at `.github/workflows/deploy.yml`
- Every push to the `main` branch triggers deployment
- The app is built and `dist/client` is published
- The GitHub Pages shell is copied so direct route refreshes continue to work

## Notes

- Text-to-speech quality depends on the platform voice engine
- Android voices may sound different from desktop voices because the browser uses system-provided voices
- This is a client-side reading experience; there is no backend required for normal use
