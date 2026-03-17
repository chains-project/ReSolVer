import { spawnSync } from "child_process"
import { recordCommand } from "../core/recorder.js"
import { resetHistory } from "../core/recorder.js"

// Returns true if update targets a specific package
export function hasPackage(args) {
  return args.some(arg => !arg.startsWith("-"))
}

export function runUpdate(args = []) {
  const result = spawnSync("npm", ["update", ...args], {
    stdio: "inherit"
  })

  // Exit if update fails
  if (result.status !== 0) {
    process.exit(result.status)
  }

  // If a package has been specified, append to history
  // Else reset history (since update fully re-resolves all dependencies)
  const incremental = hasPackage(args)

  if (incremental) {
    recordCommand({ command: "update", args })
  } else {
    resetHistory({ command: "update", args })
  }s
}