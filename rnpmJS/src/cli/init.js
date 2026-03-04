import { spawnSync } from "child_process"
import { recordCommand } from "../core/recorder.js"

export function runInit(args) {
  const res = spawnSync("npm", ["init", ...args], { stdio: "inherit" })
  if (res.status !== 0) process.exit(res.status)

  recordCommand({ command: "init", args })
}