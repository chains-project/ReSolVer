import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { compareLockfiles } from "./compareLockfiles.js"

export async function generateProof(tmp) {
  const root = process.cwd()

  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8")
  )

  const history = lock.rnpm.history

  fs.copyFileSync(
    path.join(root, "package.json"),
    path.join(tmp, "package.json")
  )

  for (const entry of history) {
    setRecordedEnvironment(entry)

    const registry = `http://npm:${entry.time}@localhost:8081`

    const args = [
    entry.command,
    ...(entry.args ?? []),
    "--registry",
    registry,
    "--package-lock-only",
    "--no-fund",
    "--no-progress",
    "--no-audit",
    "--ignore-scripts"
    ]

    const cmd = ["npm", ...args]

    execSync("npm cache clean --force", {
        cwd:tmp,
        stdio: "ignore"
    })

    execSync(cmd.join(" "), {
    cwd: tmp,
    stdio: ["ignore", "ignore", "inherit"]
    })
  }

  fs.renameSync(
    path.join(tmp, "package-lock.json"),
    path.join(root, "rnpm-proof.json")
  )
}

export function compareProof() {
  const ok = compareLockfiles("package-lock.json", "rnpm-proof.json")

  if (!ok) {
    throw new Error("Lockfiles do not match")
  }
}

function setRecordedEnvironment(entry) {
  ensureNodeVersion(entry.node)
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

function ensureNodeVersion(version) {
  const current = execSync("node -v", { encoding: "utf8" }).trim()

  if (current === version) return

  // Adapt this to your environment manager.
  // Example with n:
  execSync(`n ${version}`, { stdio: "inherit" })
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