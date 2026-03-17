import fs from "fs"

import { runInstall } from "./install.js"
import { runUpdate, hasPackage } from "./update.js"
import { runVerify } from "./verify.js"
import { runInit } from "./init.js"

import { ensureRnpmProject } from "../core/project.js"
import { checkIntegrity } from "../core/integrity.js"
import { promptYesNo } from "../utils/prompt.js"

/**
 * Entry point for CLI commands.
 * 
 * Handles:
 * - Project initialization checks
 * - rnpm project enforcement
 * - Integrity validation
 * - Command dispatch to handlers
 * @param {string} command - CLI command (install, update, init, verify) 
 * @param {string[]} args - Command arguments 
 * @returns 
 */
export async function runCommand(command, args) {

  // Ensure project exists unless making a new one
  if (!fs.existsSync("package.json") && command !== "init") {
    console.log(command)
    console.error(
      "No package.json found. Run 'rnpm init [options]' to create a project."
    )
    process.exit(1)
  }

  // Handle initialization separately
  if (command === "init") {
    runInit(args)
    return
  }

  // Is is an rnpm project?
  const projectState = ensureRnpmProject()

  // If this is not an rnpm project, either exit or convert
  if (projectState === "npm") {
    const ok = await promptYesNo(
      "This is not an rnpm project. Convert it? (This will trigger a lockfile update)"
    )

    if (!ok) process.exit(0)
    
    //TODO: Decide whether to make a smoother experience here.
    // If we don't exit or exit on condition, update could be called twice in a row
    runUpdate()
  }

  
  // Skip integrity check if the command is "update" without a target package
  // Since the rnpm history will be reset, there is no need for checking the current hash
  const allowIntegrityBypass = command === "update" && !hasPackage(args)

  // Check integrity
  const integrity = checkIntegrity()

  if (!integrity.ok && !allowIntegrityBypass) {
    const ok = await promptYesNo(
      "package.json differs from the last rnpm command. Continue? (This will trigger a lockfile update)"
    )

    if (!ok) process.exit(1)
    
      // Sync lockfile with package.json
    runUpdate()
  }

  // Dispatch command to handler
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