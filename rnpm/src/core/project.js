// Checks (somewhat loosely) that this is an rnpm project

import fs from "fs"

export function isRnpmProject() {
  if (!fs.existsSync("package-lock.json")) return false

  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"))

  return !!lock.rnpm
}

export function ensureRnpmProject() {
  if (isRnpmProject()) return "rnpm"

  if (!fs.existsSync("package.json")) {
    console.error(
      "No package.json found. Run 'rnpm init' to create a project."
    )
    process.exit(1)
  }

  return "npm"
}