import { spawnSync } from "child_process"
import { runUpdate } from "./update.js"

export function runInit(args) {
  spawnSync("npm", ["init", ...args], { stdio: "inherit" })

  runUpdate()

  console.log("Initialized rnpm project")
}