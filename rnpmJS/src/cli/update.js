import { spawnSync } from "child_process"
import { recordCommand } from "../core/recorder.js"

export function runUpdate(args) {
  const res = spawnSync("npm", ["update", ...args], { stdio: "inherit" })
  if (res.status !== 0) process.exit(res.status)

  recordCommand({ command: "update", args })
}