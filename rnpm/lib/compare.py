import json
import hashlib
import sys
from collections import deque


def make_package_name(name, data):
    return f"{name}@{data['version']}"


def get_attributes(data):
    return {k: data[k] for k in ('dev', 'optional', 'peer') if k in data}


def serialize_edges_v1(root, include_attrs=None):
    """
    include_attrs:
        None  -> ignore all attributes
        set() -> include only these attribute names
    """

    edges = []
    queue = deque()

    root_name = make_package_name(root['name'], root)

    for child_name, child_data in root.get('dependencies', {}).items():
        child_full = make_package_name(child_name, child_data)

        attrs = {}
        if include_attrs:
            attrs = {
                k: child_data[k]
                for k in include_attrs
                if k in child_data
            }

        edges.append((
            root_name,
            child_full,
            tuple(sorted(attrs.items()))
        ))

        queue.append((child_name, child_data))

    while queue:
        parent_raw, node = queue.popleft()
        parent_full = make_package_name(parent_raw, node)

        for child_name, child_data in node.get('dependencies', {}).items():
            child_full = make_package_name(child_name, child_data)

            attrs = {}
            if include_attrs:
                attrs = {
                    k: child_data[k]
                    for k in include_attrs
                    if k in child_data
                }

            edges.append((
                parent_full,
                child_full,
                tuple(sorted(attrs.items()))
            ))

            queue.append((child_name, child_data))

    return edges

def serialize_edges(data, include_attrs=None):
    edges = []
    packages = data.get("packages", {})

    for path, pkg in packages.items():
        if "version" not in pkg:
            continue

        # Determine package name
        if path == "":
            parent_name = f"{data['name']}@{pkg.get('version', data.get('version'))}"
            parent_path = ""
        else:
            name = path.split("node_modules/")[-1]
            parent_name = f"{name}@{pkg['version']}"
            parent_path = path

        for dep_name in pkg.get("dependencies", {}):
            # Try resolving child relative to parent path
            candidate_paths = [
                f"{parent_path}/node_modules/{dep_name}".lstrip("/"),
                f"node_modules/{dep_name}"
            ]

            dep_pkg = None
            for candidate in candidate_paths:
                if candidate in packages:
                    dep_pkg = packages[candidate]
                    break

            if not dep_pkg or "version" not in dep_pkg:
                continue

            child_name = f"{dep_name}@{dep_pkg['version']}"

            attrs = {}
            if include_attrs:
                attrs = {
                    k: dep_pkg[k]
                    for k in include_attrs
                    if k in dep_pkg
                }

            edges.append((
                parent_name,
                child_name,
                tuple(sorted(attrs.items()))
            ))

    return edges


def dependency_graph_hash(path, include_attrs=None):
    with open(path) as f:
        data = json.load(f)

    version = data.get("lockfileVersion", 1)

    if version == 1:
        edges = serialize_edges_v1(data, include_attrs)
    else:
        edges = serialize_edges(data, include_attrs)

    edges = sorted(edges)
    canonical = json.dumps(edges)
    return hashlib.sha256(canonical.encode()).hexdigest()




def extract_nodes(edges):
    """
    Given a list of edges in the form:
        (parent, child, attrs_tuple)

    Return a set of all unique nodes (name@version).
    """
    nodes = set()

    for parent, child, _ in edges:
        nodes.add(parent)
        nodes.add(child)

    return nodes


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 make_tree_GPT.py <lockfile1> <lockfile2>")
        sys.exit(2)

    file1 = sys.argv[1]
    file2 = sys.argv[2]

    modes = {
        "Structure": None,
        "peer": {"peer"},
        "dev": {"dev"},
        "optional": {"optional"},
    }

    results = {}

    for name, attrs in modes.items():
        h1 = dependency_graph_hash(file1, attrs)
        h2 = dependency_graph_hash(file2, attrs)
        results[name] = (h1 == h2)

    for key in ["Structure", "peer", "dev", "optional"]:
        print(f"{key:<10}: {str(results[key]).lower()}")

    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
