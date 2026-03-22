# Upgrading to a New Claude Code Version

This project patches the Claude Code CLI to reduce system prompt token usage. When Claude Code updates, the text content may change, requiring patch updates. This guide walks through updating patches for a new version.

**Good news:** `patch-cli.js` uses regex matching for `${...}` variable patterns, so patches automatically adapt to minified variable name changes (e.g., `${n3}` → `${XYZ}`). You only need to update patches when the actual text content changes.

**Key files:**
- `patch-cli.js` - applies patches to reduce prompt size
- `backup-cli.sh` - creates backup of original CLI (with hash validation)
- `restore-cli.sh` - restores CLI from backup
- `patches/*.find.txt` - text to find in bundle
- `patches/*.replace.txt` - replacement text (shorter)
- `native-extract.js` - extracts cli.js from native binary (requires `npm install node-lief`)
- `native-repack.js` - repacks patched cli.js into native binary
- `patch-native.sh` - one-command native binary patching

**Supported installations:**
- npm (Linux/macOS) - patch `cli.js` directly
- Native binary (Linux ELF, macOS Mach-O) - extract, patch, repack

## Quick Method: Let Claude Do It in a Container

The fastest way to upgrade is to have Claude Code fix the patches autonomously inside a container. This is safe because any mistakes stay isolated in the container.

### Why use a container?

1. **Safety** - patching mistakes won't break your main Claude installation
2. **Autonomy** - Claude can run with `--dangerously-skip-permissions` and iterate freely
3. **Easy recovery** - if something breaks, the container can be reset
4. **Copy when done** - only move verified patches to the host

**Container setup:** See `~/.claude/CLAUDE.md` for container configuration. Examples below use `safeclaw-upgrade`.

### For the outer Claude (or human)

If you're Claude Code running on the host and helping with an upgrade, do NOT run each docker command individually with user approval. Instead:
1. Run Steps 1-3 to set up the container
2. Kick off the container Claude in Step 4
3. Monitor with `tmux capture-pane` until it's done
4. Then copy the results back

The container Claude handles all the iteration autonomously - that's the whole point.

### Step 1: Update Claude in container

```bash
docker exec -u root safeclaw-upgrade npm install -g @anthropic-ai/claude-code@latest
docker exec safeclaw-upgrade claude --version  # verify new version
```

### Step 2: Set up the new version folder

```bash
# IMPORTANT: Delete existing folders first! docker cp merges instead of replacing,
# which causes stale patch files to accumulate from previous upgrade sessions.
docker exec safeclaw-upgrade rm -rf /home/sclaw/projects/2.X.OLD /home/sclaw/projects/2.X.NEW

# Copy previous version's patches to container
docker cp system-prompt/2.X.OLD safeclaw-upgrade:/home/sclaw/projects/

# Create new version folder from previous
# Note: chown is needed because files copied from host keep host UID
docker exec -u root safeclaw-upgrade bash -c "
  cp -r /home/sclaw/projects/2.X.OLD /home/sclaw/projects/2.X.NEW
  chown -R sclaw:sclaw /home/sclaw/projects/"

# Create backup of new cli.js (IMPORTANT: use the system's freshly installed cli.js)
docker exec safeclaw-upgrade bash -c "
  cp /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js \
     /home/sclaw/projects/2.X.NEW/cli.js.backup"

# Get the hash for patch-cli.js
docker exec safeclaw-upgrade sha256sum /home/sclaw/projects/2.X.NEW/cli.js.backup
```

### Step 3: Update patch-cli.js version and npm hash

Update the version and npm hash (native hashes are updated later in Step 8):
```bash
# Update EXPECTED_VERSION and npm hash in patch-cli.js
docker exec safeclaw-upgrade sed -i \
  -e "s/EXPECTED_VERSION = '2.X.OLD'/EXPECTED_VERSION = '2.X.NEW'/" \
  -e "s/npm: '[^']*'/npm: 'NEW_HASH_HERE'/" \
  /home/sclaw/projects/2.X.NEW/patch-cli.js
```

### Step 4: Let Claude fix the patches

Start a Claude session in tmux (so you can monitor progress):

```bash
docker exec safeclaw-upgrade tmux new-session -d -s upgrade \
  'cd /home/sclaw/projects/2.X.NEW && claude --dangerously-skip-permissions'

# Wait for it to start, then send the task
sleep 4
docker exec safeclaw-upgrade tmux send-keys -t upgrade \
  'Read UPGRADING.md for context. Update all patches for the new version.
   The backup is cli.js.backup. Test with: node patch-cli.js cli.js
   Keep fixing until all patches apply successfully.' Enter
```

Monitor progress:
```bash
docker exec safeclaw-upgrade tmux capture-pane -t upgrade -p -S -50
```

Claude will:
1. Test patches with `node patch-cli.js cli.js` (uses local backup)
2. For failing patches, find where text content diverged
3. Update .find.txt and .replace.txt files (variable names adapt automatically via regex)
4. Iterate until all patches apply

### Step 5: Test the real installation

Once patches work locally, apply to the actual Claude installation and **run the full verification checklist** (see bottom of this doc):

```bash
# Apply patches to real cli.js (needs root)
docker exec -u root safeclaw-upgrade node /home/sclaw/projects/2.X.NEW/patch-cli.js

# Test /context works
docker exec safeclaw-upgrade tmux new-session -d -s test 'claude --dangerously-skip-permissions'
sleep 4
docker exec safeclaw-upgrade tmux send-keys -t test '/context' Enter
sleep 3
docker exec safeclaw-upgrade tmux capture-pane -t test -p -S -30
```

**IMPORTANT:** Don't skip verification! Run all tests from the Final Verification Checklist before copying patches to host.

### Step 6: Copy verified patches to host

```bash
# Create folder on host
mkdir -p system-prompt/2.X.NEW/patches

# Copy from container (exclude the large cli.js.backup)
docker cp safeclaw-upgrade:/home/sclaw/projects/2.X.NEW/patch-cli.js system-prompt/2.X.NEW/
docker cp safeclaw-upgrade:/home/sclaw/projects/2.X.NEW/patches/. system-prompt/2.X.NEW/patches/

# Copy and update backup/restore scripts
cp system-prompt/2.X.OLD/backup-cli.sh system-prompt/2.X.NEW/
cp system-prompt/2.X.OLD/restore-cli.sh system-prompt/2.X.NEW/

# Update version and hash in backup-cli.sh (use same hash as patch-cli.js)
sed -i '' \
  -e 's/EXPECTED_VERSION="2.X.OLD"/EXPECTED_VERSION="2.X.NEW"/' \
  -e 's/EXPECTED_HASH="[^"]*"/EXPECTED_HASH="NEW_HASH_HERE"/' \
  system-prompt/2.X.NEW/backup-cli.sh

# Copy native patching scripts and update default version in patch-native.sh
cp system-prompt/2.X.OLD/patch-native.sh system-prompt/2.X.NEW/
cp system-prompt/2.X.OLD/native-extract.js system-prompt/2.X.NEW/
cp system-prompt/2.X.OLD/native-repack.js system-prompt/2.X.NEW/
sed -i '' 's/versions\/2.X.OLD/versions\/2.X.NEW/' system-prompt/2.X.NEW/patch-native.sh

# Optional: Clean up unused patch files (patches not listed in patch-cli.js)
# Find patches used in patch-cli.js
grep "file: '" system-prompt/2.X.NEW/patch-cli.js | sed "s/.*file: '\([^']*\)'.*/\1/" | sort > /tmp/used.txt
# Find all patch files
ls system-prompt/2.X.NEW/patches/*.find.txt | xargs -n1 basename | sed 's/\.find\.txt$//' | sort > /tmp/all.txt
# Remove unused patches
for p in $(comm -23 /tmp/all.txt /tmp/used.txt); do
  rm -v "system-prompt/2.X.NEW/patches/${p}.find.txt" "system-prompt/2.X.NEW/patches/${p}.replace.txt"
done
```

### Step 7: Apply to host and other containers

```bash
# Host
npm update -g @anthropic-ai/claude-code
cd system-prompt/2.X.NEW && ./backup-cli.sh && node patch-cli.js

# Other containers (update Claude first, then patch)
# Check ~/.claude/CLAUDE.md for current container list
for container in eager_moser delfina; do
  docker exec -u root $container npm install -g @anthropic-ai/claude-code@latest
  docker cp system-prompt/2.X.NEW $container:/tmp/
  docker exec -u root $container cp /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js \
    /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js.backup
  docker exec -u root $container node /tmp/2.X.NEW/patch-cli.js
done
```

**Note:** The loop syntax above may not work in all shells. If it fails, run each container separately or use `&&` to chain commands.

### Step 8: Test and update native hashes

`patch-cli.js` has three hashes: npm, native-linux, native-macos. After fixing patches for npm, test native builds and update their hashes.

**Warning:** Running the native install script (`curl ... | bash`) removes the npm installation. Test npm first, or reinstall npm after native testing.

```bash
# Install native in container (this removes npm install!)
docker exec safeclaw-upgrade bash -c 'curl -fsSL https://claude.ai/install.sh | bash'

# Extract cli.js and get hash
docker exec safeclaw-upgrade bash -c "cd /home/sclaw/projects/2.X.NEW && npm install node-lief"
docker exec safeclaw-upgrade node /home/sclaw/projects/2.X.NEW/native-extract.js \
  /home/sclaw/.local/share/claude/versions/2.X.NEW /tmp/native-cli.js
docker exec safeclaw-upgrade sha256sum /tmp/native-cli.js

# Update native-linux hash in patch-cli.js, then test
docker exec safeclaw-upgrade bash -c "cp /tmp/native-cli.js /tmp/native-cli.js.backup && \
  node /home/sclaw/projects/2.X.NEW/patch-cli.js /tmp/native-cli.js"
```

For macOS native, repeat on host:
```bash
curl -fsSL https://claude.ai/install.sh | bash
cd system-prompt/2.X.NEW && npm install node-lief
node native-extract.js ~/.local/share/claude/versions/2.X.NEW /tmp/mac-cli.js
shasum -a 256 /tmp/mac-cli.js
# Update native-macos hash, then test patching
```

---

# Native Binary Patching

Native Claude Code binaries (installed via `curl -fsSL https://claude.ai/install.sh | bash`) embed cli.js inside the binary. We use `node-lief` to extract, patch, and repack.

## Quick Method

```bash
cd system-prompt/2.X.NEW
npm install node-lief  # one-time setup
./patch-native.sh      # extracts, patches, repacks
```

## Manual Steps

```bash
# 1. Install dependency
npm install node-lief

# 2. Extract cli.js from binary
node native-extract.js ~/.local/share/claude/versions/2.1.17 /tmp/native-cli.js

# 3. Create backup for patcher
cp /tmp/native-cli.js /tmp/native-cli.js.backup

# 4. Apply patches
node patch-cli.js /tmp/native-cli.js

# 5. Repack into binary
node native-repack.js ~/.local/share/claude/versions/2.1.17.backup /tmp/native-cli.js ~/.local/share/claude/versions/2.1.17

# 6. Test
~/.local/bin/claude --version
~/.local/bin/claude -p "Any broken content? Yes or no."
```

## Platform Notes

| Platform | Binary Format | cli.js Location |
|----------|--------------|-----------------|
| Linux | ELF | Overlay (appended) |
| macOS | Mach-O | `__BUN/__bun` section |

macOS binaries are automatically re-signed with `codesign -s -f` after repacking.

## Hash Differences

Native binaries have different cli.js hashes than npm:
- npm and native have different minification
- macOS native uses `$` in variable names (e.g., `f$`, `u$`)
- Linux native uses standard names (e.g., `t5`, `jD`)

`patch-cli.js` accepts all known hashes and auto-adapts regex patterns.

---

# Troubleshooting

## Native installer produces corrupted binary when other versions are present

When installing a specific native version (e.g., `bash -s 2.1.32`), the installer produces a corrupted hybrid binary if other versions already exist in `~/.local/share/claude/versions/`. The resulting binary has modified system prompt text that doesn't match either the requested version or the existing one, causing most patches to fail (e.g., 2/63 instead of 63/63).

**Symptoms:**
- Hash doesn't match any known hash for that version
- Most patches show "not found" or "regex not found"
- Extracted cli.js has condensed prompt text mixed with original text

**Solution:** Clear the versions directory before installing:
```bash
rm ~/.local/share/claude/versions/*
curl -fsSL https://claude.ai/install.sh | bash -s 2.1.32
```

**Why this happens:** The install script always downloads the latest bootstrapper binary first, then runs `claude install <version>`. When other version binaries are present, the bootstrapper appears to merge or transform content from the existing binary rather than downloading a clean build of the requested version.

## Stale backup from previous session

If the container has files from a previous upgrade session, the `cli.js.backup` in the project folder may have a different hash than the freshly installed system CLI. This causes patches to fail when applied to the real installation.

**Symptoms:**
- Patches apply successfully to local test file but fail on system CLI
- Hash mismatch errors when running `patch-cli.js` on the real installation
- Container Claude reports "58/58 patches applied" but system shows "44/58"

**Solution:** Always copy the fresh system backup to the project folder:
```bash
docker exec -u root safeclaw-upgrade cp \
  /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js \
  /home/sclaw/projects/2.X.NEW/cli.js.backup
docker exec -u root safeclaw-upgrade chown sclaw:sclaw /home/sclaw/projects/2.X.NEW/cli.js.backup
```

Then update the hash in `patch-cli.js` to match and have container Claude re-fix the patches.

## How regex matching works

`patch-cli.js` auto-detects placeholder patterns and converts them to regex capture groups:

| Placeholder | Matches | Use Case |
|-------------|---------|----------|
| `${varName}` | Template literal vars like `${n3}` | Tool references in prompts |
| `__NAME__` | Plain identifiers like `kY7` | Function names in code |

**Examples:**
- `"Use ${T3} to read..."` matches even if `${T3}` became `${XYZ}` in the new version
- `function __FUNC__(A){...}` matches any function name like `kY7`, `aBC`, etc.

For VAR patches, the regex captures whatever exists in the bundle and reuses it in the replacement.

**When patches fail**, it's because the text content changed, not the variable names. Use the binary search technique below to find where text diverges.

## Finding where patch text diverges

When a patch shows "not found in bundle", find the mismatch point:

```javascript
// Run: node -e '<paste this>'
const fs = require('fs');
const bundle = fs.readFileSync('/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js', 'utf8');
const patch = fs.readFileSync('patches/PATCHNAME.find.txt', 'utf8');

let lo = 10, hi = patch.length;
while (lo < hi) {
  const mid = Math.floor((lo + hi + 1) / 2);
  bundle.indexOf(patch.slice(0, mid)) !== -1 ? lo = mid : hi = mid - 1;
}
console.log('Match up to char:', lo, 'of', patch.length);
console.log('Patch:', JSON.stringify(patch.slice(lo-20, lo+30)));
const idx = bundle.indexOf(patch.slice(0, lo));
console.log('Bundle:', JSON.stringify(bundle.slice(idx + lo - 20, idx + lo + 30)));
```

## Testing patches without root

Pass the cli.js path directly to test locally:
```bash
cp /path/to/cli.js.backup ./cli.js.backup
cp /path/to/cli.js.backup ./cli.js
node patch-cli.js ./cli.js
```

## Debugging runtime crashes

Use bisect mode to find which patch breaks:

```bash
node patch-cli.js --max=10  # apply only first N patches

# Test with tmux
tmux new-session -d -s test 'claude -p "Say hello" 2>&1 > /tmp/claude-test.txt'
sleep 12 && cat /tmp/claude-test.txt
# Binary search: works = try more, crashes = try fewer
```

**Symptoms:**
- "Execution error" with no output = variable points to non-existent function
- `TypeError: Cannot read properties of undefined` = same cause
- Claude hangs immediately = same cause
- `[object Object]` in prompt = variable resolves to wrong type (see below)

**Root cause:** `*.replace.txt` contains old variable names.

## Detecting corrupted system prompts

**Signs of corruption:**
- `[object Object]` where a tool name should be
- Minified JS leaking into text
- API error: "text content blocks must contain non-whitespace text"

**Note:** Some issues exist in unpatched Claude Code (e.g., empty bullet points). Compare against unpatched version to distinguish patch bugs from upstream bugs.

## Empty replacements break /context

When removing a section entirely, you **cannot** use an empty `.replace.txt` file. The API requires non-whitespace content in text blocks.

**Wrong:** Empty `code-references.replace.txt` causes `/context` to fail with:
```
Error: 400 "text content blocks must contain non-whitespace text"
```

**Correct:** Use a minimal placeholder like `# .` in `code-references.replace.txt`:
```
# .
```

This appears as a harmless orphan section header but keeps the API happy.

**Why remove code-references?** The original reminds Claude to cite code with `file_path:line_number` format. Removing it saves ~360 chars. Claude can still do this naturally without the instruction - the patch just removes the explicit reminder.

## Function-based patches

Some patches replace entire functions (like `allowed-tools`). Use `__NAME__` placeholders for function and helper names:

**Step 1: Find the function by its unique string content:**
```bash
# Find byte offset of the unique string
grep -b 'You can use the following tools without requiring user approval' \
  "$(which claude | xargs realpath | xargs dirname)/cli.js"
```

**Step 2: Extract context around that offset:**
```bash
# Use dd to get surrounding bytes (adjust skip value from grep output)
dd if="$(which claude | xargs realpath | xargs dirname)/cli.js" \
  bs=1 skip=10482600 count=500 2>/dev/null
```

This reveals the full function signature including the new function name and helper variables.

**Step 3: Update both find and replace files** with the new function name and all helper variables.

**CRITICAL: The replace.txt must use the NEW function name!** If `allowed-tools.find.txt` looks for `function n75(A)`, then `allowed-tools.replace.txt` must define `function n75(A){return""}`, NOT the old name. Using the old name (e.g., `S85`) creates a duplicate declaration error:
```
SyntaxError: Identifier 'S85' has already been declared
```
This is the most common mistake with function-based patches.

## Using container Claude to investigate patches

Claude Code can help find where text content changed:

```bash
# Ask Claude to find exact text differences
docker exec container claude --dangerously-skip-permissions -p \
  'Read patches/bash-tool.find.txt and search for this exact text in
   /path/to/cli.js.backup. Tell me where it differs.'
```

Note: Variable mapping (`${X}→${Y}`) is now automatic via regex matching. You only need Claude's help when the actual text content changed.

---

# Final Verification Checklist

Test all three build types: npm, native-linux, native-macos.

**Per-build checklist:**
| Test | npm | Linux native | macOS native |
|------|-----|--------------|--------------|
| Patches apply 58/58 | [ ] | [ ] | [ ] |
| `/context` works | [ ] | [ ] | [ ] |
| Corruption test | [ ] | [ ] | [ ] |
| Self-report test | [ ] | [ ] | [ ] |
| Tool test (Bash) | [ ] | [ ] | [ ] |
| Restore works | [ ] | [ ] | [ ] |

**File checklist:**
- [ ] Required files present (`patch-cli.js`, `backup-cli.sh`, `restore-cli.sh`, `patches/`)
- [ ] All three hashes in `patch-cli.js` (npm, native-linux, native-macos)
- [ ] npm hash matches in `backup-cli.sh`

## Quick Verification Commands

```bash
# Corruption test
claude -p 'Any [object Object] or [DYNAMIC] in your prompt? Yes or no only.'

# Self-report test
claude -p 'Anything weird in your system prompt? Brief answer.'

# Tool test
claude -p 'Run: echo "tools work"' --allowedTools Bash
```

**Note:** `claude -p` requires API credentials. In containers, use interactive mode via tmux instead (see Step 5).

For native builds, restore by copying the backup:
```bash
cp ~/.local/share/claude/versions/2.X.NEW.backup ~/.local/share/claude/versions/2.X.NEW
```

All checks passing for all three builds = upgrade complete!
