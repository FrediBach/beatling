import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/** Adds the small Cloudflare worker and metadata expected by OpenAI Sites. */
export function sites(): Plugin {
  let root = process.cwd();
  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const metadataDirectory = resolve(root, "dist", ".openai");
      const serverDirectory = resolve(root, "dist", "server");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      await rm(metadataDirectory, { recursive: true, force: true });
      await mkdir(metadataDirectory, { recursive: true });
      await mkdir(serverDirectory, { recursive: true });
      if (await exists(hostingConfig)) await cp(hostingConfig, resolve(metadataDirectory, "hosting.json"));
      await writeFile(
        resolve(serverDirectory, "index.js"),
        "export default { fetch(request, env) { return env.ASSETS.fetch(request); } };\n",
      );
    },
  };
}
