import fs from "fs"
import os from "os"
import { execSync } from "child_process"
import { sha256File } from "../utils/hash.js"

function readLock() {
  return JSON.parse(fs.readFileSync("package-lock.json", "utf8"))
}

function writeLock(lock) {
  fs.writeFileSync(
    "package-lock.json",
    JSON.stringify(lock, null, 2) + "\n"
  )
}

function buildRecord({ command, args }) {
  return {
    command,
    args,
    npm: execSync("npm -v").toString().trim(),
    node: process.version,
    time: new Date().toISOString(),
    os: os.release()
  }
}

export function recordCommand({ command, args }) {
  const lock = readLock()

  lock.rnpm ??= {}
  lock.rnpm.history ??= []

  lock.rnpm.history.push(buildRecord({ command, args }))

  // Update manifest hash
  lock.manifestIntegrity = sha256File("package.json")

  writeLock(lock)
}

export function resetHistory({ command, args }) {
  const lock = readLock()

  lock.rnpm ??= {}
  lock.rnpm.history = [buildRecord({ command, args })]

  // Update manifest hash
  lock.manifestIntegrity = sha256File("package.json")

  writeLock(lock)
}
