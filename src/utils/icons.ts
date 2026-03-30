import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import streamDeck from "@elgato/streamdeck";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dirname, "..");

function toDataUri(relativePath: string): string {
  try {
    // @2x 버전 우선 시도
    const path2x = join(PLUGIN_DIR, `${relativePath}@2x.png`);
    const path1x = join(PLUGIN_DIR, `${relativePath}.png`);
    let buf: Buffer;
    try {
      buf = readFileSync(path2x);
    } catch {
      buf = readFileSync(path1x);
    }
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch (err) {
    streamDeck.logger.error(`Icon not found: ${relativePath} - ${err}`);
    return "";
  }
}

// iTerm Navigate 아이콘
const ITERM_ICONS: Record<string, string> = {};
for (const mode of ["tab-prev", "tab-next", "pane-prev", "pane-next", "split-v", "split-h", "new-tab"]) {
  ITERM_ICONS[mode] = toDataUri(`imgs/actions/iterm/key/${mode}`);
}

// Send to iTerm 아이콘
const SEND_ICONS: Record<string, string> = {};
for (const mode of ["yes", "stop", "commit", "text"]) {
  SEND_ICONS[mode] = toDataUri(`imgs/actions/send/key/${mode}`);
}

export function getITermIcon(mode: string): string {
  const mapped: Record<string, string> = {
    "tab-prev": "tab-prev",
    "tab-next": "tab-next",
    "pane-prev": "pane-prev",
    "pane-next": "pane-next",
    "split-vertical": "split-v",
    "split-horizontal": "split-h",
    "new-tab": "new-tab",
  };
  return ITERM_ICONS[mapped[mode] ?? "tab-next"] ?? "";
}

export function getSendIcon(mode: string, text: string): string {
  if (mode === "ctrl-c") return SEND_ICONS["stop"] ?? "";
  if (text === "y" || text === "yes") return SEND_ICONS["yes"] ?? "";
  if (text.startsWith("/commit")) return SEND_ICONS["commit"] ?? "";
  return SEND_ICONS["text"] ?? "";
}

// processing 상태용 STOP 아이콘 (주황색 배경 + 흰색 정지)
const STOP_PROCESSING_SVG = `<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#ff6d00"/>
  <rect x="40" y="40" width="64" height="64" rx="8" fill="#fff"/>
  <text x="72" y="130" text-anchor="middle" font-size="16" font-family="sans-serif" fill="#fff">Processing</text>
</svg>`;

export const STOP_PROCESSING_ICON = `data:image/svg+xml;base64,${Buffer.from(STOP_PROCESSING_SVG).toString("base64")}`;
