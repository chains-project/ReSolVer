import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import os from "os"
import path from "path"
import {
  __testing__,
  backupLockfile,
  buildReplayArgs,
  removeBackup,
  restoreBackupIfNeeded,
} from "../src/core/verifier.js"
import { __testing__ as verifyCliTesting } from "../src/cli/verify.js"

test("backupLockfile creates package-lock.json in a custom backup dir", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)

  assert.equal(
    fs.readFileSync(path.join(backupDir, "package-lock.json"), "utf8"),
    '{\n  "name": "root-lock"\n}\n'
  )
})

test("restoreBackupIfNeeded restores a missing root lockfile", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)
  fs.rmSync(path.join(root, "package-lock.json"), { force: true })

  assert.equal(restoreBackupIfNeeded(root, backupDir), true)
  assert.equal(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
    '{\n  "name": "root-lock"\n}\n'
  )
})

test("restoreBackupIfNeeded restores a differing root lockfile", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)
  fs.writeFileSync(path.join(root, "package-lock.json"), '{"generated":true}\n')

  assert.equal(restoreBackupIfNeeded(root, backupDir), true)
  assert.equal(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
    '{\n  "name": "root-lock"\n}\n'
  )
})

test("restoreBackupIfNeeded is a no-op when files are identical", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)

  assert.equal(restoreBackupIfNeeded(root, backupDir), false)
  assert.equal(
    __testing__.filesEqual(
      path.join(root, "package-lock.json"),
      path.join(backupDir, "package-lock.json")
    ),
    true
  )
})

test("restoreBackupIfNeeded preserves an existing proof file", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
    "rnpm-replication.json": '{"proof":true}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)
  fs.writeFileSync(path.join(root, "package-lock.json"), '{"generated":true}\n')

  restoreBackupIfNeeded(root, backupDir)

  assert.equal(
    fs.readFileSync(path.join(root, "rnpm-replication.json"), "utf8"),
    '{"proof":true}\n'
  )
})

test("removeBackup deletes the custom backup dir", () => {
  const root = makeProject({
    "package-lock.json": '{\n  "name": "root-lock"\n}\n',
  })
  const backupDir = path.join(root, ".tmp-backup")

  backupLockfile(root, backupDir)
  removeBackup(root, backupDir)

  assert.equal(fs.existsSync(backupDir), false)
})

test("buildReplayArgs keeps replay package-lock-only and before semantics", () => {
  const installArgs = buildReplayArgs(
    {
      command: "install",
      args: ["left-pad"],
      time: "2026-05-11T12:00:00.000Z",
    },
    "/tmp/cache"
  )
  const uninstallArgs = buildReplayArgs(
    {
      command: "uninstall",
      args: ["left-pad"],
      time: "2026-05-11T12:00:00.000Z",
    },
    "/tmp/cache"
  )

  assert.deepEqual(installArgs.slice(0, 4), [
    "install",
    "left-pad",
    "--before",
    "2026-05-11T12:00:00.000Z",
  ])
  assert.equal(uninstallArgs.includes("--before"), false)
  assert.equal(installArgs.includes("--package-lock-only"), true)
  assert.equal(installArgs.includes("--ignore-scripts"), true)
  assert.equal(installArgs.includes("--cache"), true)
})

test("runVerify restores the original lockfile before comparing proof", async () => {
  const calls = []
  const root = process.cwd()
  const originalExitCode = process.exitCode

  try {
    await verifyCliTesting.runVerifyWith([], makeVerifyDeps({
      backupLockfile(root, backupDir) {
        calls.push(["backupLockfile", root, backupDir])
        return { backupPath: path.join(backupDir, "package-lock.json") }
      },
      async generateProof(tmp) {
        calls.push(["generateProof", tmp])
      },
      compareProof(originalPath, proofPath) {
        calls.push(["compareProof", originalPath, proofPath])
      },
      restoreBackupIfNeeded(root, backupDir) {
        calls.push(["restoreBackupIfNeeded", root, backupDir])
        return true
      },
      removeBackup(root, backupDir) {
        calls.push(["removeBackup", root, backupDir])
      },
      restoreEnvironment(version) {
        calls.push(["restoreEnvironment", version])
      },
      rmSync(target, options) {
        calls.push(["rmSync", target, options])
      },
      moveFileSync(src, dst) {
        calls.push(["moveFileSync", src, dst])
      },
    }))
  } finally {
    process.exitCode = originalExitCode
  }

  const compareIndex = calls.findIndex(([name]) => name === "compareProof")
  const restoreIndex = calls.findIndex(([name]) => name === "restoreBackupIfNeeded")
  const removeIndex = calls.findIndex(([name]) => name === "removeBackup")
  const restoreEnvIndex = calls.findIndex(([name]) => name === "restoreEnvironment")
  const compareCall = calls[compareIndex]

  assert.notEqual(compareIndex, -1)
  assert.notEqual(restoreIndex, -1)
  assert.notEqual(removeIndex, -1)
  assert.notEqual(restoreEnvIndex, -1)
  assert.ok(compareIndex < restoreIndex)
  assert.ok(restoreIndex < removeIndex)
  assert.equal(compareCall[1], path.join("C:\\project\\tmp", ".backup", "package-lock.json"))
  assert.equal(compareCall[2], path.join(root, "rnpm-replication.json"))
})

test("runVerify restores and cleans up after proof generation failure", async () => {
  const calls = []
  const originalExitCode = process.exitCode

  try {
    await verifyCliTesting.runVerifyWith([], makeVerifyDeps({
      backupLockfile(root, backupDir) {
        calls.push(["backupLockfile", root, backupDir])
        return { backupPath: path.join(backupDir, "package-lock.json") }
      },
      async generateProof(tmp) {
        calls.push(["generateProof", tmp])
        throw new Error("boom")
      },
      restoreBackupIfNeeded(root, backupDir) {
        calls.push(["restoreBackupIfNeeded", root, backupDir])
        return true
      },
      removeBackup(root, backupDir) {
        calls.push(["removeBackup", root, backupDir])
      },
      restoreEnvironment(version) {
        calls.push(["restoreEnvironment", version])
      },
      rmSync(target, options) {
        calls.push(["rmSync", target, options])
      },
    }))
  } finally {
    process.exitCode = originalExitCode
  }

  assert.equal(calls.some(([name]) => name === "compareProof"), false)
  assert.equal(calls.some(([name]) => name === "restoreBackupIfNeeded"), true)
  assert.equal(calls.some(([name]) => name === "removeBackup"), true)
  assert.equal(calls.some(([name]) => name === "restoreEnvironment"), true)
})

test("runVerify skips npm restore when --keep-npm is set", async () => {
  const calls = []
  const originalExitCode = process.exitCode

  try {
    await verifyCliTesting.runVerifyWith(["--keep-npm"], makeVerifyDeps({
      backupLockfile(root, backupDir) {
        calls.push(["backupLockfile", root, backupDir])
        return { backupPath: path.join(backupDir, "package-lock.json") }
      },
      async generateProof(tmp) {
        calls.push(["generateProof", tmp])
      },
      compareProof(originalPath, proofPath) {
        calls.push(["compareProof", originalPath, proofPath])
      },
      restoreBackupIfNeeded(root, backupDir) {
        calls.push(["restoreBackupIfNeeded", root, backupDir])
        return true
      },
      removeBackup(root, backupDir) {
        calls.push(["removeBackup", root, backupDir])
      },
      restoreEnvironment(version) {
        calls.push(["restoreEnvironment", version])
      },
    }))
  } finally {
    process.exitCode = originalExitCode
  }

  assert.equal(calls.some(([name]) => name === "restoreEnvironment"), false)
})

function makeProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rnpm-test-"))

  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath)

    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, contents)
  }

  return root
}

function makeVerifyDeps(overrides = {}) {
  return {
    backupLockfile(root, backupDir) {
      return { backupPath: path.join(backupDir, "package-lock.json") }
    },
    compareProof() {},
    execSync() {
      return "10.0.0"
    },
    existsSync(target) {
      return target === "C:\\project\\tmp"
    },
    async generateProof() {},
    mkdtempSync() {
      return "C:\\project\\tmp"
    },
    moveFileSync() {},
    promptYesNo: async () => false,
    removeBackup() {},
    restoreBackupIfNeeded() {
      return false
    },
    restoreEnvironment() {},
    rmSync() {},
    ...overrides,
  }
}
