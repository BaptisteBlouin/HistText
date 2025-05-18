# HistText Frontend

This directory contains the frontend of HistText – a single-page application (SPA) built with React and TypeScript. The frontend provides the user interface for interacting with HistText: uploading and managing texts, performing searches, viewing visualizations, and administering the system.

## Tech Stack

- Framework: React
- Language: TypeScript
- Build Tool: Vite (bundler and dev server)
- UI Components: (Uses standard React libraries; e.g., may use Material-UI or Ant Design for certain components – to be confirmed by code.)
- State Management: Local component state and React Context or hooks (since this is a relatively contained app, a heavy state management library might not be used, unless the code introduces Redux or similar).
- Routing: React Router (likely) – for navigating between views (e.g., login, admin dashboard, search page, document view, etc.).

The choice of Vite means the development server is fast and the production build outputs files (JS/CSS) along with a manifest for integration with the backend.

## Development (Running the Frontend Locally)

Ensure you have Node.js (>= 18.x) and npm installed.

### 1. Install dependencies:

```bash
cd app/frontend
npm install
```

This will download all required packages into node_modules/. You should run this any time package.json changes or on first setup.

### 2. Start the dev server:

```bash
npm start
```

This will launch the Vite development server (often on http://localhost:3000). It should automatically open your default browser to the app. If not, open the URL manually.

While the dev server is running:
- The app will live-reload on changes. Edit source files in src/ and see the changes immediately in the browser.
- API calls from the frontend (to the backend) should be proxied to the backend server. The dev server is likely configured to proxy requests starting with e.g. /api to localhost:8000 (check vite.config.ts or similar). If the proxy is not set, you might experience CORS issues – you can configure a proxy or set environment variables for API URL.
- Ensure the backend is running on the expected port (default 8000) for API calls to succeed. See the backend README for running the backend alongside the frontend dev server.

### 3. Building the frontend (production bundle):

```bash
npm run build
```

This creates an optimized production build in the dist/ directory. It includes:
- Bundled JavaScript files (likely with hashes in filenames for caching)
- CSS files
- assets/ (images, fonts, etc. if any)
- manifest.json (which maps entry names to file names, used by the backend to serve the correct files)

After building, you can preview the production build locally by running a simple static server or using Vite's preview:

```bash
npm run preview
```

This will serve the dist folder on a local port so you can test the production version.

### 4. Linting and Formatting:

(Optional) If the project includes ESLint or Prettier, you can run:

```bash
npm run lint
npm run format
```

(These scripts depend on whether they've been set up in package.json.)

Ensure your code follows the style guidelines (e.g., no unused variables, proper spacing, etc.). Typically, the project might include a default ESLint/Prettier config from the template.



## Using the Frontend

Once running, the frontend provides a user-friendly interface:

- Login: Users can log in with their credentials. (The app might redirect to /admin by default for login since this is primarily an admin interface right now.)
- Admin Dashboard: After login, an admin can navigate the dashboard. This likely includes sections or tabs for:
  - Managing Documents: uploading new texts (with metadata), listing existing documents, editing/deleting them.
  - Search Interface: a form to submit search queries (with options for filtering by metadata, full-text search with keywords, date range, etc.). Results are displayed in a list or table, with highlights for matched terms.
  - NER View: possibly a way to view named entities extracted from the corpus. This might be integrated into the search results (e.g., showing entities alongside texts) or a separate page that lists all entities with frequencies.
  - Users & Roles: (Admin only) manage user accounts, assign roles, reset passwords.
  - Settings: configure application settings like enabling/disabling features, adjusting thresholds (some of these might require editing the .env and restarting backend in current version, but a UI for settings might be planned).
  - Statistics/Visualization: view generated charts or metrics about the corpus (e.g., document count over time, top entities, word clouds, etc.). If implemented, this could be a dashboard section that queries the backend's stats endpoints and renders charts using a library like Chart.js or D3.

The frontend communicates with the backend via HTTP API calls (likely using fetch or a library like Axios). API endpoints are protected, so the frontend will include the authentication token (maybe stored in local storage or a cookie) in each request. Ensure you handle auth errors (if a session expires, the frontend should redirect to login).

## Configuration & Environment (Frontend)

In most cases, the frontend will use relative URLs to talk to the backend (i.e., if the frontend is served from the same domain, API calls might go to /api/...). During development, Vite's dev server may proxy these calls to localhost:8000. Check vite.config.ts – if there's a proxy field:

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  }
}
```

This would send any request starting with /api to the backend. If the API endpoints aren't all under a common prefix, the proxy might be configured for specific paths or the frontend code might specify the full URL.


## Building for Production

After running `npm run build`, the dist/ folder will contain everything needed for the frontend. In a production deployment:
- These files can be served by a static web server (e.g., Nginx, or GitHub Pages for documentation).
- In our case, the Rust backend is capable of serving these static files. Typically, the backend (with create-rust-app) will use the CRA_MANIFEST_PATH and CRA_FRONTEND_DIR environment variables to locate the dist files and serve them on requests to the web root. This means you might not need a separate web server; the backend can act as one.

If you open the app in production mode (through the backend on port 8000, after building and restarting the backend in release mode), it should function the same as in development.

## Testing the Frontend

If tests are set up, run `npm test`. If not, it's recommended to add tests for complex components or logic:
- Use React Testing Library to render components and simulate user interactions.
- Test critical flows like login form (enter username/password, click submit, see that api/login was called and that on success, the app state updates).
- Test that key components (document upload form, search form) validate inputs and handle responses correctly (you can mock fetch calls using Jest mocks).

(As of now, tests might be minimal. This is an area where contributions are helpful!)

## Troubleshooting (Frontend)

- White screen / App not loading: Check the browser console for errors. Common issues could be a misconfigured API URL (if the app can't reach the backend, you might see network errors), or a runtime error (stacktrace in console).
- CORS issues in dev: If you see CORS errors, ensure the dev proxy is working or configure the backend to allow the dev origin. You can add temporary CORS allowances in the backend (for development) or set up the proxy in Vite config.
- Hot reload not working: Occasionally, the Vite dev server might not reflect changes (rare). Restart `npm start` if needed.
- Dependencies not found errors: After pulling new changes, if the app fails to compile (missing module), run `npm install` to get the latest packages.
- Outdated browser builds: If you served the app via the backend and then updated the frontend, you might still see old files (cached). Hard-refresh the browser or clear cache. When developing, use the dev server for immediate updates.

## Deployment

For production deployment of the frontend:
- If using the Rust backend to serve static files: simply ensure `npm run build` has been run, and the dist folder is in place. When you run the backend in release mode, it should serve the files. Verify by hitting the backend's root URL (e.g., http://yourserver:8000) and see if the app loads.
- If using an external server (like serving via Nginx/Apache or a CDN): upload the contents of dist/ to the server and configure it to serve index.html for the app's base path. Also set up redirect rules so that deep links (e.g., /admin or /search) all serve index.html (since this is a SPA that manages routing client-side). Alternatively, use the HTML5 history mode fallback – Nginx snippet example:
  ```
  location / {
    try_files $uri /index.html;
  }
  ```
  This ensures any route not matching a static file serves the index, letting React handle it.

Make sure the backend API is accessible to the frontend. If on the same domain, configure appropriate proxies or CORS. If on different subdomain, configure CORS in the backend to allow the frontend's origin, or use a reverse proxy to unify them.

Typically, you'll run the backend on some port (or behind a reverse proxy on a path), and possibly serve the frontend files directly from the backend (to simplify deployment).

## Contributing (Frontend)

We welcome contributions to improve the frontend:
- UI/UX improvements (better layout, responsive design, accessibility)
- New features (e.g., advanced filtering UI, result highlighting, interactive charts)
- Internationalization (the app could support multiple languages in the UI text)
- Bug fixes (if you find any UI bugs or inconsistencies)

Before submitting changes:
- Ensure `npm run build` still produces a working app.
- If you introduce new npm packages, make sure they are necessary and lightweight.
- Follow the code style of existing components (consistent use of hooks, functional components, etc.).
- Test your changes in both dev and a production build to catch any issues.

## Known TODOs (Frontend)

- Better Visualizations: The current version might have basic charts for stats. We plan to integrate a more robust charting library for timelines, word clouds, etc.
- Testing: Add more React tests, particularly for critical components like the search form and results list.
- Code Splitting: As the app grows, consider splitting code for different routes to optimize load time (using React lazy/Suspense with Vite dynamic imports).
- CSS and Theming: Possibly refactor some CSS for maintainability, and provide a way to theme the application (dark mode, etc., if needed by users).

By having both the backend and frontend running, you should be able to fully use HistText locally. For any issues specific to the frontend, feel free to open an issue on GitHub. When describing a frontend issue, include browser console logs or screenshots if applicable.

Thanks for contributing to HistText's frontend!