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

## How to use rnpm

### Commands
The currently supported commands are `install`, `i`, `init`, `update` (from `npm`), and `verify`.

### Flags
Flags have generally not been tested. I recommend always using `--package-lock-only` and `--no-script` when testing the tool. These flags automatically used during verification. 

Flag `--registry` will cause issues so custom registries are currently not supported.

#### `verify`
`--regen` - Skips potential prompt and forces proof to be regenerated.

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

## Output
Regular npm commands should have the usual output, with the exception of the added fields `rnpm` and `manifestIntegrity`. `init` will unlike regular `npm` produce a lockfile.

`verify` produces the (attempted) replication of the lockfile, `rnpm-replication.json`, and prints:

- `structure`: Compares all edges but does not care about labels.
- `peer`: Compares all edges and checks that peer dependencies in the original lockfile are peer dependencies in the reproduced lockfile.
- `dev`: Compares all edges and checks that dev dependencies in the original lockfile are dev dependencies in the reproduced lockfile.
- `optional`: Compares all edges and checks that optional dependencies in the original lockfile are optional dependencies in the reproduced lockfile.

## Irreproducibility: A feature, not a bug

One of the greatest challenges for reproducing a `package-lock.json` from a `package.json` is the iterative nature of `npm install` combined with the ephemeral state of package registries.

**An example:**

1. Run `npm install pkgA`. `pkgA: ^1.0.0` is added to `package.json` and resolves to `pkgA@1.0.0` which is added to `package-lock.json`.
2. `pkgA@1.0.1` is released.
3. `pkgB@1.0.0` is released.
4. Run `npm install pkgB`. `pkgB: ^1.0.0` is added to `package.json` and resolves to `pkgB@1.0.0` which is added to `package-lock.json`.
5. Given the `package.json` file, is there a way to resolve the dependencies and get the exact same solution presented in the original `package-lock.json`? No.
6. If we resolve the dependencies of `package.json` the resulting lockfile will contain `pkgA@1.0.1` and `pkgB@1.0.0`.