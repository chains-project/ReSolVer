# rnpm - reproducible npm

**(WIP)**

Prototype for verifiable dependency resolution for npm. The project has only been tested on `5.15.167.4-microsoft-standard-WSL2`.

## How to install

### 1. OSS-rebuild, timewarp
This project requires a fork of OSS-rebuild's timewarp. To install:

```
git clone https://github.com/TimothyLindquist/oss-rebuild.git
cd oss-rebuild
go build ./cmd/timewarp
```
```
mkdir -p "$HOME/.local/bin"
mv timewarp "$HOME/.local/bin/"
export PATH="$HOME/.local/bin:$PATH"
source ~/.bashrc   # or `source ~/.zshrc` depending on your shell
```

### 2. Clone and install

#### GitHub

Using HTTPS:

```
git clone https://github.com/chains-project/ReSolVer.git
cd ReSolVer
git checkout js-rewrite
```

Using SSH (if configured):

```
git clone git@github.com/chains-project/ReSolVer.git
cd ReSolVer
git checkout js-rewrite
```

#### Install

Recommended (no sudo):

```
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH="$HOME/.npm-global/bin:$PATH"
source ~/.bashrc
```

With sudo:

```
sudo npm link
```

---

## How to use rnpm

### Commands
The currently supported commands are:
`install`, `i`, `init`, `update`, and `verify`.

### Flags

Most npm flags are not explicitly supported or tested.

For consistent behavior, it is recommended to use:
- `--package-lock-only`
- `--ignore-scripts`

These flags are automatically applied during verification.

Custom registries are not currently supported. Using `--registry`
may lead to incorrect behavior.

**`verify`**

- `--regen` — skip the prompt and force regeneration of the proof
  (`rnpm-replication.json`)
  (`rnpm-replication.json`)

### Example

```
mkdir tst
cd tst
rnpm init -y
rnpm install react --package-lock-only --ignore-scripts
rnpm verify
```

Expected output:
```
structure : true
peer      : true
dev       : true
optional  : true
Verification completed
```

---

## Output

### `package-lock.json`

The following fields are appended to the lockfile produced by npm:

- `manifestIntegrity` - sha256 hash of `package.json`.

  Records which `package.json` the lockfile claims to correspond to.
  This is an integrity marker, not a proof of correctness.

- `rnpm` - metadata used for reproduction and verification.

  - `history` - ordered list of commands used to produce the lockfile.

    These entries define the replay trace used during verification.

    - `command` - CLI command (e.g. `install`, `update`)
    - `args` - CLI arguments passed to the command
    - `npm` - npm version used for the command
    - `time` - timestamp (RFC 3339), e.g. `2026-03-17T15:18:17.497Z`

      Used during verification to query the registry state at that
      point in time.

### `rnpm-replication.json`
A reconstructed `package-lock.json` produced during verification,
without the additional `rnpm` and `manifestIntegrity` fields.
Used for comparison with the original lockfile.

### Terminal

Commands behave like their `npm` counterparts, with the exception that
`package-lock.json` includes the additional fields `rnpm` and
`manifestIntegrity`. The `init` command also produces a lockfile,
unlike `npm init`.

The `verify` command generates a reconstructed lockfile,
`rnpm-replication.json`, and prints the following checks:

- `structure` — compares the dependency graph structure (edges only),
  ignoring dependency attributes.

- `peer` — verifies that peer dependencies are preserved.

- `dev` — verifies that dev dependencies are preserved.

- `optional` — verifies that optional dependencies are preserved.

---

## Irreproducibility: A feature, not a bug

One of the greatest challenges for reproducing a `package-lock.json` from a `package.json` is the iterative nature of `npm install` combined with the ephemeral state of package registries.

**An example:**

1. Run `npm install pkgA`. `pkgA: ^1.0.0` is added to `package.json` and resolves to `pkgA@1.0.0` which is added to `package-lock.json`.
2. `pkgA@1.0.1` is released.
3. `pkgB@1.0.0` is released.
4. Run `npm install pkgB`. `pkgB: ^1.0.0` is added to `package.json` and resolves to `pkgB@1.0.0` which is added to `package-lock.json`.
5. Given the `package.json` file, is there a way to resolve the dependencies and get the exact same solution presented in the original `package-lock.json`? No.
6. If we resolve the dependencies of `package.json` the resulting lockfile will contain `pkgA@1.0.1` and `pkgB@1.0.0`.