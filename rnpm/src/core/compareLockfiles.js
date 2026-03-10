import fs from "fs"
import crypto from "crypto"

function makeName(name, version) {
  return `${name}@${version}`
}

function pickAttrs(pkg, filter) {
  if (!filter) return []
  const attrs = []

  for (const key of filter) {
    if (key in pkg) {
      attrs.push([key, pkg[key]])
    }
  }

  attrs.sort()
  return attrs
}

function edgesFromLockV3(data, attrFilter) {

  const edges = []
  const packages = data.packages || {}

  for (const [pkgPath, pkg] of Object.entries(packages)) {

    if (!pkg.version) continue

    let parentName
    let parentPath

    if (pkgPath === "") {
      parentName = makeName(data.name, pkg.version || data.version)
      parentPath = ""
    } else {
      const name = pkgPath.split("node_modules/").pop()
      parentName = makeName(name, pkg.version)
      parentPath = pkgPath
    }

    for (const dep of Object.keys(pkg.dependencies || {})) {

      const candidates = [
        `${parentPath}/node_modules/${dep}`.replace(/^\//, ""),
        `node_modules/${dep}`
      ]

      let depPkg = null

      for (const candidate of candidates) {
        if (packages[candidate]) {
          depPkg = packages[candidate]
          break
        }
      }

      if (!depPkg || !depPkg.version) continue

      const childName = makeName(dep, depPkg.version)

      edges.push([
        parentName,
        childName,
        pickAttrs(depPkg, attrFilter)
      ])
    }
  }

  return edges
}

function edgesFromLockV1(data, attrFilter) {

  const edges = []
  const queue = []

  const rootName = makeName(data.name, data.version)

  for (const [childName, child] of Object.entries(data.dependencies || {})) {

    const childFull = makeName(childName, child.version)

    edges.push([
      rootName,
      childFull,
      pickAttrs(child, attrFilter)
    ])

    queue.push([childName, child])
  }

  let i = 0

  while (i < queue.length) {

    const [parentRaw, node] = queue[i++]
    const parentFull = makeName(parentRaw, node.version)

    for (const [childName, child] of Object.entries(node.dependencies || {})) {

      const childFull = makeName(childName, child.version)

      edges.push([
        parentFull,
        childFull,
        pickAttrs(child, attrFilter)
      ])

      queue.push([childName, child])
    }
  }

  return edges
}

function graphHash(lockfilePath, attrFilter = null) {

  const data = JSON.parse(fs.readFileSync(lockfilePath, "utf8"))

  let edges

  if ((data.lockfileVersion || 1) === 1) {
    edges = edgesFromLockV1(data, attrFilter)
  } else {
    edges = edgesFromLockV3(data, attrFilter)
  }

  edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  const canonical = JSON.stringify(edges)

  return crypto
    .createHash("sha256")
    .update(canonical)
    .digest("hex")
}

export function compareLockfiles(fileA, fileB) {

  const modes = {
    structure: null,
    peer: new Set(["peer"]),
    dev: new Set(["dev"]),
    optional: new Set(["optional"])
  }

  const results = {}

  for (const [name, attrs] of Object.entries(modes)) {

    const h1 = graphHash(fileA, attrs)
    const h2 = graphHash(fileB, attrs)

    results[name] = h1 === h2
  }

  for (const key of ["structure", "peer", "dev", "optional"]) {
    console.log(`${key.padEnd(10)}: ${results[key]}`)
  }

  return Object.values(results).every(Boolean)
}