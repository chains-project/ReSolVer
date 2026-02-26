# rnpm - reproducible npm

**NOTE:** This PoC is not usable as is. Requires an unpublished fork of OSS-rebuild's timewarp and must improve logic for correctness.

## Irreproducibility: A feature, not a bug

One of the greatest challenges for reproducing a `package-lock.json` from a `package.json` is the iterative nature of `npm install` combined with the ephemeral state of package registries.

**An example:**

1. Run `npm install pkgA`. `pkgA: ^1.0.0` is added to `package.json` and resolves to `pkgA@1.0.0` which is added to `package-lock.json`.
2. `pkgA@1.0.1` is released.
3. `pkgB@1.0.0` is released.
4. Run `npm install pkgB`. `pkgB: ^1.0.0` is added to `package.json` and resolves to `pkgB@1.0.0` which is added to `package-lock.json`.
5. Given the `package.json` file, is there a way to resolve the dependencies and get the exact same solution presented in the original `package-lock.json`? No.
6. If we resolve the dependencies of `package.json` the resulting lockfile will contain `pkgA@1.0.1` and `pkgB@1.0.0`.