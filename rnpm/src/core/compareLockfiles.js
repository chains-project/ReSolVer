import fs from "fs"
import crypto from "crypto"

/**
* Creates unique identifier for nodes of the dependency graph
* @param {string} name - dependency name
* @param {string} version - dependency version
* @returns {string} name@version
*/
function makeName(name, version) {
  return `${name}@${version}`
}

/**
 * Selects and normalizes specific attributes from a package object
 * 
 * Returns a sorted list of [key, value] pairs for the attributes.
 * Used to ensure deterministic comparison when hashing dependency graphs.
 * @param {object} pkg - Package object from lockfile
 * @param {set<string>|null} filter - Set of attribute names to extract (e.g. dev, optional, peer) 
 * @returns {Array<[string, any]>} Sorted list of attribute key-value pairs
 */

function pickAttrs(pkg, filter) {
  if (!filter) return []
  const attrs = []

  for (const key of filter) {
    if (key in pkg) {
      attrs.push([key, pkg[key]])
    }
  }

  // Ensure deterministic ordering of attributes by key for stable hashing
  attrs.sort((a, b) => a[0].localeCompare(b[0]))
  return attrs
}

/**
 * Extract dependency edges from a npm/rnpm lockfile v2/v3.
 * 
 * An edge represents a dependency relationship: [parentName, childName, attributes],
 * where parentName and childName are of the form "name@version"
 * 
 * Lockfile v2/v3 presents transitive dependencies in a flat structure
 * To extract dependency relationships, we use the install paths instead 
 * of tree traversal
 * 
 * Notes:
 * - Builds a logical dependency graph from the lockfile
 * - That is, package identity is based on name@version
 * - Duplicate packages are treated as a single node
 * - It does not necessarily represent the install tree
 * 
 * @param {object} data - Parsed lockfile JSON 
 * @param {Set<string>|null} attrFilter - Attributes to include for edges
 * @returns {Array<[string, string, Array]>} List of dependency edges
 */
function edgesFromLockV3(data, attrFilter) {

  const edges = []
  const packages = data.packages || {}

  for (const [pkgPath, pkg] of Object.entries(packages)) {

    // Only process dependencies with a specified version
    // TODO: Verify if any valid lockfile entries may lack a version
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

      // Try both as local and hoisted dependency
      const candidates = [
        `${parentPath}/node_modules/${dep}`.replace(/^\//, ""),
        `node_modules/${dep}`
      ]

      let depPkg = null

      // First candidate match wins
      for (const candidate of candidates) {
        if (packages[candidate]) {
          depPkg = packages[candidate]
          break
        }
      }

      // Skips unresolved dependencies
      // TODO: Decide whether unresolved dependencies should be reported instead of skipped
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

/**
 * Extract dependency edges from a npm/rnpm lockfile v1
 * 
 * An edge represents a dependency relationship: [parentName, childName, attributes],
 * where parentName and childName are of the form "name@version"
 * 
 * Since lockfile v1 is structured differently compared to v2/v3, 
 * we traverse the tree breadth-first and record the edges
 * 
 * Notes:
 * - Lockfile v1 represents dependencies as a nested tree structure
 * - Like edgesFromLockV3, only the logical dependency graph is considered
 * 
 * @param {object} data - Parsed lockfile JSON 
 * @param {Set<string>|null} attrFilter - Attributes to include for edges
 * @returns {Array<[string, string, Array]>} List of dependency edges
 */
function edgesFromLockV1(data, attrFilter) {

  const edges = []
  const queue = []
  
  const rootName = makeName(data.name, data.version)

  for (const [childName, child] of Object.entries(data.dependencies || {})) {

    // Only process dependencies with a specified version
    // TODO: Verify if any valid lockfile entries may lack a version
    if (!child.version) continue
    const childFull = makeName(childName, child.version)

    edges.push([
      rootName,
      childFull,
      pickAttrs(child, attrFilter)
    ])

    queue.push([childName, child])
  }

  let i = 0

  // BF traversal of the dependency tree
  while (i < queue.length) {

    const [parentRaw, node] = queue[i++]
    const parentFull = makeName(parentRaw, node.version)

    for (const [childName, child] of Object.entries(node.dependencies || {})) {

      // Only process dependencies with a specified version
      // TODO: Verify if any valid lockfile entries may lack a version
      if (!child.version) continue
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

/**
 * Computes a deterministic hash of a lockfile's dependency graph.
 *
 * The lockfile is transformed into a canonical representation by:
 * 1. Extracting dependency edges
 * 2. Sorting edges deterministically
 * 3. Serializing to JSON
 * 4. Hashing using SHA-256
 *
 * This allows comparison of lockfiles based on logical dependency structure,
 * independent of ordering or formatting differences.
 *
 * @param {string} lockfilePath - Path to lockfile
 * @param {Set<string>|null} attrFilter - Attributes to include for edges
 * @returns {string} SHA-256 hash of the canonical dependency graph
 */
function graphHash(lockfilePath, attrFilter = null) {

  const data = JSON.parse(fs.readFileSync(lockfilePath, "utf8"))

  let edges

  // Choose extraction method based on lockfile version
  // Default to v1 if version is missing
  // TODO: Decide whether to default to a version or throw error
  if ((data.lockfileVersion || 1) === 1) {
    edges = edgesFromLockV1(data, attrFilter)
  } else {
    edges = edgesFromLockV3(data, attrFilter)
  }

  // Sort edges deterministically to ensure consistent hashing
  edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  // Serialize canonical edge list
  const canonical = JSON.stringify(edges)

  // Compute SHA-256 hash of canonical representation
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