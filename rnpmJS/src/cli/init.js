import fs from "fs"

export function runInit() {

  // Create package.json if missing
  if (!fs.existsSync("package.json")) {
    const pkg = {
      name: "rnpm-project",
      version: "1.0.0"
    }

    fs.writeFileSync(
      "package.json",
      JSON.stringify(pkg, null, 2) + "\n"
    )

    console.log("Created package.json")
  }

  // Initialize rnpm metadata if lockfile exists
  if (fs.existsSync("package-lock.json")) {

    const lock = JSON.parse(
      fs.readFileSync("package-lock.json", "utf8")
    )

    lock.rnpm ??= {}
    lock.rnpm.history ??= []

    fs.writeFileSync(
      "package-lock.json",
      JSON.stringify(lock, null, 2) + "\n"
    )

    console.log("Initialized rnpm metadata in package-lock.json.")
  } else {
    console.log(
      "package-lock.json not found. Run 'rnpm install' to generate it."
    )
  }
}