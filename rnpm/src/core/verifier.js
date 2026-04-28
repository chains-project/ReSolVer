import fs from "fs"
import path from "path"
import { execSync, spawnSync } from "child_process"
import { compareLockfiles } from "./compareLockfiles.js"

export async function generateProof(tmp) {
  const root = process.cwd()
  const proofPath = path.join(tmp, "rnpm-replication.json")

  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
  )

  const history = lock.rnpm.history

  fs.copyFileSync(
    path.join(root, "package.json"),
    path.join(tmp, "package.json")
  )

  const cachePath = path.join(tmp, ".npm-cache")

  for (const entry of history) {
    setRecordedEnvironment(entry)

    runNpm(buildReplayArgs(entry, cachePath), tmp)
  }

  fs.renameSync(
    path.join(tmp, "package-lock.json"),
    proofPath
  )
}

export function compareProof() {
  const result = compareLockfiles("package-lock.json", "rnpm-replication.json")

  if (!result.ok) {
    throw new Error(result.message)
  }
}

export function buildReplayArgs(entry, cachePath = null) {
  const args = [
    entry.command,
    ...(entry.args ?? [])
  ]

  if (usesBefore(entry.command)) {
    args.push("--before", entry.time)
  }

  args.push(
    "--package-lock-only",
    "--no-fund",
    "--no-progress",
    "--no-audit",
    "--ignore-scripts"
  )

  if (cachePath) {
    args.push("--cache", cachePath)
  }

  return args
}

function usesBefore(command) {
  return command === "install" || command === "update"
}

function runNpm(args, cwd, stdio = ["ignore", "ignore", "inherit"]) {
  const result = spawnSync("npm", args, { cwd, stdio })

  if (result.error) {
    throw new Error(`npm ${args[0]} failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`npm ${args[0]} failed`)
  }
}

function setRecordedEnvironment(entry) {
  ensureNpmVersion(entry.npm)

  // OS cannot realistically be changed here.
  // Best effort: verify and warn.
  const currentOs = getCurrentOs()

  if (entry.os && currentOs !== entry.os) {
    console.warn(
      `Warning: recorded os=${entry.os}, current os=${currentOs}`
    )
  }
}

function ensureNpmVersion(version) {
  const current = execSync("npm -v", { encoding: "utf8" }).trim()

  if (current === version) return

  execSync(`npm install -g npm@${version}`, { stdio: "inherit" })
}

function getCurrentOs() {
  try {
    return fs.readFileSync("/proc/sys/kernel/osrelease", "utf8").trim()
  } catch {
    return process.platform
  }
}
