import fs from "fs"
import os from "os"
import { execSync } from "child_process"
import { sha256File } from "../utils/hash.js"

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"))
}

function writeJson(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2) + "\n")
}

export function recordCommand({ command, args }) {
  const lockPath = "package-lock.json"
  if (!fs.existsSync(lockPath)) throw new Error("package-lock.json not found")
  if (!fs.existsSync("package.json")) throw new Error("package.json not found")

  const lock = readJson(lockPath)

  const record = {
    command,               // "install" | "update" later
    args,                  // exact argv slice
    npm: execSync("npm -v").toString().trim(),
    node: process.version,
    time: new Date().toISOString(),
    os: os.release(),
    manifest_hash: sha256File("package.json")
  }

  lock.rnpm ??= {}
  lock.rnpm.history ??= []
  lock.rnpm.history.push(record)

  writeJson(lockPath, lock)
}