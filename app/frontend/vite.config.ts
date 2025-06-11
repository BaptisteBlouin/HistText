import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const buildRollupInput = (isDevelopment): { [entryAlias: string]: string } => {
  const rollupInput: { [entryAlias: string]: string } = isDevelopment
    ? {
        "dev.tsx": resolve(__dirname, "./src/dev.tsx"),
      }
    : {};

  // Use fs instead of glob to avoid dependencies
  const bundlesDir = resolve(__dirname, "./bundles");
  try {
    const findTsxFiles = (dir: string): string[] => {
      const files: string[] = [];
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...findTsxFiles(fullPath));
        } else if (item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
      
      return files;
    };

    const tsxFiles = findTsxFiles(bundlesDir);
    tsxFiles.forEach((inputEntry: string) => {
      let outputEntry = inputEntry;
      // output entry is an absolute path, let's remove the absolute part:
      outputEntry = outputEntry.replace(`${__dirname}/`, "");
      // replace directory separator with "__"
      outputEntry = outputEntry.replace(/\//g, "__");

      rollupInput[outputEntry] = inputEntry;
    });
  } catch (error) {
    console.warn("Could not read bundles directory:", error);
  }

  return rollupInput;
};

// https://vitejs.dev/config/
export default defineConfig(async ({ command, mode }) => ({
  base: command === "serve" ? "http://localhost:21012" : "/",
  clearScreen: false,
  build: {
    manifest: true,
    rollupOptions: {
      input: buildRollupInput(command === "serve"),
    },
  },
  define: {
    // When this variable is set, setupDevelopment.tsx will also be loaded!
    // See `dev.tsx` which is included in development.
    "import.meta.env.DEV_SERVER_PORT": String(process.env.DEV_SERVER_PORT),
  },
  plugins: [react()],

  server: {
    port: 21012,
    host: "0.0.0.0",
    proxy: {
      // with options
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/graphql": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true, // This can help on some systems
      interval: 100, // Adjust the interval as needed
    },
  },
}));
