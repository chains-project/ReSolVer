import fs from "fs"
import path from "path"
import { spawn, execSync } from "child_process"
import { generateProof, compareProof } from "../core/verifier.js"
import { promptYesNo } from "../utils/prompt.js"
import { waitForPort } from "../utils/port.js"

/**
 * Verifies that the current lockfile can be deterministically reproduced.
 *
 * The process:
 * - Optionally reuses an existing replication proof
 * - Starts a timewarp registry for deterministic dependency resolution
 * - Replays recorded install history in a temporary environment
 * - Generates a replicated lockfile
 * - Compares the replicated lockfile with the original
 *
 * Side effects:
 * - Temporarily modifies Node and npm versions
 * - Starts and stops a background process (timewarp)
 * - Creates and deletes a temporary working directory
 *
 * @param {string[]} args - CLI arguments (supports --regen to force regeneration)
 */
export async function runVerify(args = []) {

  // Allow flag to skip regeneration prompt
  const forceRegen = args.includes("--regen")

  
  const os = require("os")
  const tmp = path.join(os.tmpdir(), "rnpm-proof")
  const proofPath = path.join(root, "rnpm-replication.json")

  let useExistingProof = false

  // If a previous replication file exists, optionally reuse it
  if (!forceRegen && fs.existsSync(proofPath)) {

    useExistingProof = await promptYesNo(
      "rnpm-replication.json already exists. Verify existing proof?"
    )
  }

  if (useExistingProof) {
    compareProof()
    return
  }

  // Save environment for restoration
  const originalNpm = execSync("npm -v", { encoding: "utf8" }).trim()

  let timewarp = null

  // Reset /tmp/rnpm-proof
  if (fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  fs.mkdirSync(tmp)

  try {

    // Start timewarp registry. Used to filter dependencies by publish date
    timewarp = startTimewarp()

    // Wait until registry is reachable
    if (!(await waitForPort(8081))) {
    throw new Error("Port 8081 is not open (timewarp not running?)")
    }

    // Replicate lockfile
    await generateProof(tmp)

    // Compare replicated lockfile with original
    compareProof()

    console.log("Verification completed")

  } catch (err) {

    console.error("Verification failed:", err.message)
    process.exitCode = 1

  } finally {

    // Restore original environments
    restoreEnvironment(originalNode, originalNpm)

    // Stop timewarp
    if (timewarp) {
      stopProcessTree(timewarp)
    }

    // Clean up tmp dir
    if (fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }
}

// Restore npm versions
function restoreEnvironment(npmVersion) {

  try {
    execSync(`npm install -g npm@${npmVersion}`, { stdio: "ignore" })
  } catch {}
}

// Start timewarp in background
function startTimewarp() {
  return spawn("timewarp", [], {
    stdio: "ignore",
    detached: true
  })
}

// Terminate timewarp process group
function stopProcessTree(child) {
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {}

  try {
    child.kill("SIGTERM")
  } catch {}
}