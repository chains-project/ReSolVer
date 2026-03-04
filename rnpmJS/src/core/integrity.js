import fs from "fs"
import { sha256File } from "../utils/hash.js"

export function checkIntegrity() {
  if (!fs.existsSync("package-lock.json")) {
    return { ok: true }
  }

  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"))

  const history = lock.rnpm?.history
  if (!history || history.length === 0) {
    return { ok: true }
  }

  const last = history.at(-1)

  const currentHash = sha256File("package.json")

  if (currentHash === last.manifest_hash) {
    return { ok: true }
  }

  return {
    ok: false,
    expected: last.manifest_hash,
    actual: currentHash
  }
}