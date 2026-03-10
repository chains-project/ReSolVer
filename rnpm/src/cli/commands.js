import fs from "fs"

import { runInstall } from "./install.js"
import { runUpdate, hasPackage } from "./update.js"
import { runVerify } from "./verify.js"
import { runInit } from "./init.js"

import { ensureRnpmProject } from "../core/project.js"
import { checkIntegrity } from "../core/integrity.js"
import { promptYesNo } from "../utils/prompt.js"


export async function runCommand(command, args) {

  // --- Check for package.json if command is not init ---
  if (!fs.existsSync("package.json") && command !== "init") {
    console.log(command)
    console.error(
      "No package.json found. Run 'rnpm init [options]' to create a project."
    )
    process.exit(1)
  }

  // --- Special case ---
  if (command === "init") {
    runInit(args)
    return
  }

  const projectState = ensureRnpmProject()

  // --- Non-rnpm project ---
  if (projectState === "npm") {
    const ok = await promptYesNo(
      "This is not an rnpm project. Convert it? (This will trigger a lockfile update)"
    )

    if (!ok) process.exit(0)

    runUpdate()
  }

  
  // --- Skip integrity check if the command is "update" without a target package ---
  const allowIntegrityBypass = command === "update" && !hasPackage(args)

  // --- Integrity check ---
  const integrity = checkIntegrity()

  if (!integrity.ok && !allowIntegrityBypass) {
    const ok = await promptYesNo(
      "package.json differs from the last rnpm command. Continue? (This will trigger a lockfile update)"
    )

    if (!ok) process.exit(1)
    
    runUpdate()
  }

  switch (command) {

    case "install":
    case "i":
      runInstall(args)
      break

    case "update":
      runUpdate(args)
      break

    case "verify":
      runVerify(args)
      break

    default:
      console.log("Usage: rnpm <install|update|init|verify>")
  }
}