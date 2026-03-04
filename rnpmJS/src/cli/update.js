import { spawnSync } from "child_process"
import { recordCommand } from "../core/recorder.js"
import { resetHistory } from "../core/recorder.js"

function hasPackage(args) {
  return args.some(arg => !arg.startsWith("-"))
}

export function runUpdate(args) {
  const result = spawnSync("npm", ["update", ...args], {
    stdio: "inherit"
  })

  if (result.status !== 0) {
    process.exit(result.status)
  }

  const incremental = hasPackage(args)

  if (incremental) {
    recordCommand({ command: "update", args })
  } else {
    resetHistory({ command: "update", args })
  }
}