import fs from "fs"

import { runInstall } from "./install.js"
import { runUpdate } from "./update.js"
import { runVerify } from "./verify.js"
import { runInit } from "./init.js"
import { runConvert } from "./convert.js"

import { ensureRnpmProject } from "../core/project.js"
import { checkIntegrity } from "../core/integrity.js"
import { promptYesNo } from "../utils/prompt.js"


export async function runCommand(command, args) {

  if (command === "init") {
    runInit(args)
    return
  }

  // --- Check for package.json ---
  if (!fs.existsSync("package.json")) {
    console.error(
      "No package.json found. Run 'rnpm init [options]' to create a project."
    )
    process.exit(1)
  }

  const projectState = ensureRnpmProject()

  // --- Non-rnpm project ---
  if (projectState === "npm") {
    const ok = await promptYesNo(
      "This is not an rnpm project. Convert it?"
    )

    if (!ok) process.exit(0)

    runConvert()
  }

  // --- Integrity check ---
  const integrity = checkIntegrity()

  if (!integrity.ok) {
    const ok = await promptYesNo(
      "package.json differs from the last rnpm command. Continue?"
    )

    if (!ok) process.exit(1)
  }

  switch (command) {

    case "install":
      runInstall(args)
      break

    case "update":
      runUpdate(args)
      break

    case "verify":
      runVerify(args)
      break

    default:
      console.log("Usage: rnpm <install|update|verify|init>")
  }
}