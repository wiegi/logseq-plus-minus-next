import { build, context } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

await mkdir("dist", { recursive: true });
await copyFile("index.html", "dist/index.html");

const options = {
  entryPoints: ["src/main.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100"],
  minify: !watch,
  sourcemap: watch,
  logLevel: "info"
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching Plus Minus Next…");
} else {
  await build(options);
}
