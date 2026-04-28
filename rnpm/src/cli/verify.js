import fs from "fs"
import path from "path"
import os from "os"
import { execSync } from "child_process"
import { generateProof, compareProof } from "../core/verifier.js"
import { promptYesNo } from "../utils/prompt.js"

/**
 * Verifies that the current lockfile can be deterministically reproduced.
 *
 * The process:
 * - Optionally reuses an existing replication proof
 * - Replays recorded install history in a temporary environment using npm --before
 * - Generates a replicated lockfile
 * - Compares the replicated lockfile with the original
 *
 * Side effects:
 * - Temporarily modifies Node and npm versions
 * - Creates and deletes a temporary working directory
 *
 * @param {string[]} args - CLI arguments (supports --regen to force regeneration)
 */
export async function runVerify(args = []) {

  // Allow flag to skip regeneration prompt
  const forceRegen = args.includes("--regen")

  const root = process.cwd()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rnpm-"))
  const proofPath = path.join(root, "rnpm-replication.json")
  const tmpProofPath = path.join(tmp, "rnpm-replication.json")

  let useExistingProof = false

  // If a previous replication file exists, optionally reuse it
  if (!forceRegen && fs.existsSync(proofPath)) {

    useExistingProof = await promptYesNo(
      "rnpm-replication.json already exists. Verify existing proof?"
    )
  }

  if (useExistingProof) {
    try {
      compareProof()
      console.log("Verification completed")
    } catch (err) {
      console.error("Verification failed:", err.message)
      process.exitCode = 1
    }

    return
  }

  // Save environment for restoration
  const originalNpm = execSync("npm -v", { encoding: "utf8" }).trim()

  try {

    // Replicate lockfile
    await generateProof(tmp)

    // Move the generated proof from the temp workspace into the current dir
    fs.rmSync(proofPath, { force: true })
    fs.renameSync(tmpProofPath, proofPath)

    // Compare replicated lockfile with original
    compareProof()

    console.log("Verification completed")

  } catch (err) {

    console.error("Verification failed:", err.message)
    process.exitCode = 1

  } finally {

    // Restore original environments
    restoreEnvironment(originalNpm)

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

