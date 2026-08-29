#!/usr/bin/env bash
set -euo pipefail

GODOT_VERSION="4.6.3-stable"
GODOT_DIR_VERSION="4.6.3.stable"

echo "Setting up Godot ${GODOT_VERSION} for Linux CI..."

mkdir -p /tmp/godot
cd /tmp/godot

# Download Godot Linux binary if not present
if ! command -v godot &> /dev/null; then
  echo "Downloading Godot ${GODOT_VERSION} Linux binary..."
  curl -sSL -f "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" -o godot.zip || \
  curl -sSL -f "https://downloads.tuxfamily.org/godotengine/${GODOT_VERSION%-*}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" -o godot.zip
  
  unzip -q godot.zip
  sudo mv Godot_v${GODOT_VERSION}_linux.x86_64 /usr/local/bin/godot
  sudo chmod +x /usr/local/bin/godot
fi

# Download and install Export Templates
TEMPLATE_DIR="$HOME/.local/share/godot/export_templates/${GODOT_DIR_VERSION}"
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "Downloading Godot ${GODOT_VERSION} export templates..."
  mkdir -p "$TEMPLATE_DIR"
  curl -sSL -f "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_export_templates.tpz" -o templates.tpz || \
  curl -sSL -f "https://downloads.tuxfamily.org/godotengine/${GODOT_VERSION%-*}/Godot_v${GODOT_VERSION}_export_templates.tpz" -o templates.tpz
  
  unzip -q templates.tpz
  mv templates/* "$TEMPLATE_DIR/"
fi

godot --version
echo "Godot ${GODOT_VERSION} setup complete."
