import { runInstall } from "./install.js"
import { runUpdate } from "./update.js"
import { checkIntegrity } from "../core/integrity.js"
import { promptYesNo } from "../utils/prompt.js"

const command = process.argv[2]
const args = process.argv.slice(3)
const integrity = checkIntegrity()

if (!integrity.ok) {
  const answer = await promptYesNo(
    "Integrity check failed. No correspondence claim between package.json and package-lock.json. Continue? (recommended: npm update)"
  )
  
}


switch (command) {
  case "install":
    runInstall(args)
    break

  case "update":
    runUpdate(args)
    break

  case "verify":
    console.log("rnpm verify not implemented yet")
    break

  default:
    console.log("Usage: rnpm <install|update|verify>")
}