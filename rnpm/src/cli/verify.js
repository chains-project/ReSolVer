import fs from "fs"
import path from "path"
import { spawn, execSync } from "child_process"
import { generateProof, compareProof } from "../core/verifier.js"
import { promptYesNo } from "../utils/prompt.js"
import { waitForPort } from "../utils/port.js"

export async function runVerify(args = []) {

  // Allow flag to skip regeneration prompt
  const forceRegen = args.includes("--regen")

  
  const os = require("os")
  const tmp = path.join(os.tmpdir(), "rnpm-proof")
  const proofPath = path.join(root, "rnpm-replication.json")

  let useExistingProof = false

  if (!forceRegen && fs.existsSync(proofPath)) {

    useExistingProof = await promptYesNo(
      "rnpm-replication.json already exists. Verify existing proof?"
    )
  }

  if (useExistingProof) {
    compareProof()
    return
  }

  const originalNode = execSync("node -v", { encoding: "utf8" }).trim()
  const originalNpm = execSync("npm -v", { encoding: "utf8" }).trim()

  let timewarp = null

  if (fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  fs.mkdirSync(tmp)

  try {

    timewarp = startTimewarp()

    // Check that the registry is reachable
    if (!(await isPortOpen(8081))) {
    throw new Error("Port 8081 is not open (timewarp not running?)")
    }

    await generateProof(tmp)

    compareProof()

    console.log("Verification completed")

  } catch (err) {

    console.error("Verification failed:", err.message)
    process.exitCode = 1

  } finally {

    restoreEnvironment(originalNode, originalNpm)

    if (timewarp) {
      stopProcessTree(timewarp)
    }

    if (fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
}

function restoreEnvironment(nodeVersion, npmVersion) {

  try {
    execSync(`n ${nodeVersion}`, { stdio: "ignore" })
  } catch {}

  try {
    execSync(`npm install -g npm@${npmVersion}`, { stdio: "ignore" })
  } catch {}
}

function startTimewarp() {
  return spawn("timewarp", [], {
    stdio: "ignore",
    detached: true
  })
}

function stopProcessTree(child) {
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {}

  try {
    child.kill("SIGTERM")
  } catch {}
}