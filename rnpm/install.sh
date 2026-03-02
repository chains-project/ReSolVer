#!/usr/bin/env bash
set -euo pipefail

echo "Installing rnpm (user-local)..."

PREFIX="${HOME}/.local"
LIB_DIR="${PREFIX}/lib/rnpm"
BIN_DIR="${PREFIX}/bin"

mkdir -p "${LIB_DIR}" "${BIN_DIR}"

# Strip Windows CRLF endings (portable across GNU/BSD sed)
for f in rnpm lib/*.sh; do
  sed -i.bak 's/\r$//' "$f"
  rm -f "$f.bak"
done

# Install files
install -m 755 rnpm "${LIB_DIR}/rnpm"
rm -rf "${LIB_DIR}/lib"
cp -r lib "${LIB_DIR}/lib"

# Make it callable
ln -sf "${LIB_DIR}/rnpm" "${BIN_DIR}/rnpm"

echo "rnpm successfully installed to ${BIN_DIR}/rnpm"

# Helpful PATH hint
if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
  echo
  echo "Note: ${BIN_DIR} is not on your PATH."
  echo "Add this line to your shell config (~/.bashrc or ~/.zshrc):"
  echo "  export PATH=\"${BIN_DIR}:\$PATH\""
fi