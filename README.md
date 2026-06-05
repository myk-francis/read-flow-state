# ReadAlong

ReadAlong is a browser-based EPUB reader that reads books aloud, keeps your place, and gives you a cleaner reading surface than raw EPUB layouts.

## Live project

After GitHub Pages finishes deploying, the app will be available at:

```text
https://myk-francis.github.io/read-flow-state/
```

## Local development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run code quality checks:

```bash
npm run lint
npm run format
```

## GitHub Pages deployment

This repository is already configured for GitHub Pages deployment through GitHub Actions.

### One-time GitHub setup

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings -> Pages`.
4. Under `Source`, select `GitHub Actions`.

### How deployment works

- The workflow file is at `.github/workflows/deploy.yml`.
- Every push to the `main` branch triggers a new deployment.
- The workflow builds the app and publishes `dist/client`.
- TanStack Start SPA mode generates `dist/client/_shell.html`.
- The workflow copies that shell to `index.html` and `404.html` so direct route refreshes work on GitHub Pages.

### Manual deployment trigger

You can also run the workflow manually from the `Actions` tab on GitHub using `workflow_dispatch`.

## Notes

- GitHub Pages is static hosting, so this setup is intended for the current client-side app.
- Uploaded EPUB files and reading progress are stored in the browser on the user's device.
