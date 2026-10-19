#!/usr/bin/env bash
# Render "Build Command": bash build.sh
# Downloads Java 21 (JDK, needed for compiling) and Node 22 into ./tools,
# installs the Python packages, and compiles the warm Java compiler.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p tools

JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz"
NODE_URL="https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.xz"

if [ ! -x tools/jdk/bin/java ]; then
  echo "Downloading Java 21..."
  rm -rf tools/jdk && mkdir -p tools/jdk
  curl -fsSL "$JDK_URL" | tar -xz -C tools/jdk --strip-components=1
fi
if [ ! -x tools/node/bin/node ]; then
  echo "Downloading Node 22..."
  rm -rf tools/node && mkdir -p tools/node
  curl -fsSL "$NODE_URL" | tar -xJ -C tools/node --strip-components=1
fi

pip install -r requirements.txt
mkdir -p java/classes
tools/jdk/bin/javac -d java/classes java/CompileServer.java
echo "Runner build finished: $(tools/jdk/bin/java -version 2>&1 | head -1), node $(tools/node/bin/node --version)"
