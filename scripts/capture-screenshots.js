import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("docs/screenshots");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const targets = [
  { name: "home-feed.png", url: "https://resume-zeta-one-86.vercel.app/" },
  { name: "watch-stream.png", url: "https://resume-zeta-one-86.vercel.app/watch/6ae4d54bfd09b1416dd7d801" },
  { name: "watch-party.png", url: "https://resume-zeta-one-86.vercel.app/watch-party" },
  { name: "upload-studio.png", url: "https://resume-zeta-one-86.vercel.app/upload" },
  { name: "auth-portal.png", url: "https://resume-zeta-one-86.vercel.app/login" },
];

for (const target of targets) {
  const dest = path.join(outDir, target.name);
  console.log(`Capturing ${target.name} from ${target.url}...`);
  try {
    execFileSync(chromePath, [
      "--headless=new",
      `--screenshot=${dest}`,
      "--window-size=1440,900",
      "--hide-scrollbars",
      "--virtual-time-budget=6000",
      target.url,
    ], { stdio: "inherit", timeout: 20000 });
    console.log(`Saved ${target.name}`);
  } catch (err) {
    console.warn(`Failed capturing ${target.name}:`, err.message);
  }
}

