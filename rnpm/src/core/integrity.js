import fs from "fs"
import { sha256File } from "../utils/hash.js"

export function checkIntegrity() {
  if (!fs.existsSync("package-lock.json")) {
    return { ok: true }
  }

  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"))

  if (!lock.manifestIntegrity) {
    return { ok: true }
  }

  const currentHash = sha256File("package.json")

  if (currentHash === lock.manifestIntegrity) {
    return { ok: true }
  }

  return {
    ok: false,
    expected: lock.manifestIntegrity,
    actual: currentHash
  }
}