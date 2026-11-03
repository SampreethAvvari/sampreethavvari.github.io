// Builds this branch against the space site's own Workers and publishes it to
// space.sampreethavvari.com. Pass --no-build to publish the dist that is there.
import { execSync } from "node:child_process";

const env = {
  ...process.env,
  PUBLIC_CHAT_ENDPOINT: "https://sampreeth-chatbot-space.sampreethavvariedu.workers.dev/chat",
  PUBLIC_TEACHING_API: "https://sampreeth-teaching-space.sampreethavvariedu.workers.dev",
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

if (!process.argv.includes("--no-build")) run("npm run build");
run("npx --yes wrangler@4 deploy");
