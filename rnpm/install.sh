#!/usr/bin/env bash
set -euo pipefail

echo "Installing rnpm..."

sed -i 's/\r$//' rnpm lib/*.sh

sudo mkdir -p /usr/local/lib/rnpm
sudo cp -r rnpm lib /usr/local/lib/rnpm/

sudo ln -sf /usr/local/lib/rnpm/rnpm /usr/local/bin/rnpm
sudo chmod +x /usr/local/lib/rnpm/rnpm

echo "rnpm successfully installed"