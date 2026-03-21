#!/usr/bin/env bash
# flash installer/updater
# Install: curl -fsSL https://raw.githubusercontent.com/3li7alaki/flash/main/install.sh | bash
# Update:  same command — it's idempotent
set -euo pipefail

REPO="3li7alaki/flash"
FLASH_HOME="$HOME/.flash"
LINK_DIR="$HOME/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/flash"
DECKS_DIR="$HOME/flashcards"

echo ""
echo "  flash — flashcard CLI with AI superpowers"
echo ""

# ─── Step 1: Clone or update flash repo ──────────────────────────────────────

if [ -d "$FLASH_HOME/.git" ]; then
  echo "  Updating flash..."
  # Ensure LF line endings (WSL with Windows git may default to CRLF)
  git -C "$FLASH_HOME" config core.autocrlf input
  git -C "$FLASH_HOME" fetch origin main -q 2>/dev/null || true
  git -C "$FLASH_HOME" clean -fd -q 2>/dev/null || true
  git -C "$FLASH_HOME" reset --hard origin/main -q 2>/dev/null || true
  MODE="update"
else
  echo "  Installing flash..."
  git clone -q -c core.autocrlf=input "https://github.com/$REPO.git" "$FLASH_HOME" 2>/dev/null || {
    # If clone fails (dir exists but not git), remove and retry
    rm -rf "$FLASH_HOME"
    git clone -q -c core.autocrlf=input "https://github.com/$REPO.git" "$FLASH_HOME"
  }
  MODE="install"
fi

# ─── Step 2: Ensure Bun is installed ──────────────────────────────────────────

if ! command -v bun &>/dev/null; then
  echo "  Bun not found — installing (required for flash CLI)..."
  curl -fsSL https://bun.sh/install | bash 2>/dev/null || {
    echo "  ✗ Bun install failed. Install manually: https://bun.sh"
    echo "    flash CLI requires Bun to run."
    exit 1
  }
  # Source bun into current shell
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun &>/dev/null; then
    echo "  ✓ Bun $(bun --version) installed"
  else
    echo "  ✗ Bun installed but not in PATH. Add to your shell profile:"
    echo "    export BUN_INSTALL=\"\$HOME/.bun\""
    echo "    export PATH=\"\$BUN_INSTALL/bin:\$PATH\""
    exit 1
  fi
else
  echo "  ✓ Bun $(bun --version) found"
fi

# ─── Step 3: Install dependencies ─────────────────────────────────────────────

(cd "$FLASH_HOME" && bun install --frozen-lockfile 2>/dev/null || bun install 2>/dev/null) || {
  echo "  ✗ Failed to install dependencies."
  exit 1
}

# ─── Step 4: Make CLI globally available ───────────────────────────────────────

FLASH_BIN="$FLASH_HOME/src/cli.ts"
if [ -f "$FLASH_BIN" ]; then
  chmod +x "$FLASH_BIN"

  mkdir -p "$LINK_DIR"
  ln -sf "$FLASH_BIN" "$LINK_DIR/flash"
  echo "  ✓ CLI linked: $LINK_DIR/flash"
else
  echo "  ✗ CLI not found at $FLASH_BIN"
  exit 1
fi

# Check PATH
case ":$PATH:" in
  *":$LINK_DIR:"*) ;;
  *)
    echo ""
    echo "  NOTE: $LINK_DIR is not in your PATH."
    echo "  Add to your shell profile (~/.bashrc or ~/.zshrc):"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    ;;
esac

# ─── Step 5: Create default config ────────────────────────────────────────────

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/config.json" << 'CONF'
{
  "ai": {
    "provider": "openrouter",
    "apiKey": "",
    "model": "anthropic/claude-sonnet-4"
  },
  "scheduler": {
    "algorithm": "fsrs-5"
  },
  "review": {
    "aiGrading": true,
    "showHints": true,
    "cardsPerSession": 0
  },
  "decksDir": "~/flashcards",
  "editor": "$EDITOR",
  "version": 1
}
CONF
  echo "  ✓ Default config created: $CONFIG_DIR/config.json"
fi

if [ ! -d "$DECKS_DIR" ]; then
  mkdir -p "$DECKS_DIR"
  echo "  ✓ Flashcards directory created: $DECKS_DIR"
fi

# ─── Done ──────────────────────────────────────────────────────────────────────

VERSION=$(grep -o '"version": "[^"]*"' "$FLASH_HOME/package.json" 2>/dev/null | head -1 | grep -o '[0-9][^"]*' || echo "unknown")

echo ""
if [ "$MODE" = "update" ]; then
  echo "  flash v${VERSION} updated successfully."
else
  echo "  flash v${VERSION} installed successfully."
fi
echo ""
echo "  Quick start:"
echo "    flash new \"My First Deck\"     # Create a deck"
echo "    flash add my-first-deck       # Add cards"
echo "    flash review                  # Start reviewing"
echo "    flash config                  # Set up AI (optional)"
echo ""
