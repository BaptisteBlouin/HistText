// This file is used by ViteJS to help deliver the frontend in development mode

import "vite/modulepreload-polyfill"; // Polyfill for module preloading (performance optimization)

// Sets up the development environment.
//
// Note: When running `cargo frontend` and `cargo backend` individually, "DEV_SERVER_PORT" is not set.
//       Use `cargo fullstack` for the full development experience.
if (import.meta.env.DEV_SERVER_PORT) {
  import("./setupDevelopment");
}
