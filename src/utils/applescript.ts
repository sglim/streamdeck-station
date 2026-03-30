import { execFile } from "node:child_process";

export function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/osascript", ["-e", script], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
