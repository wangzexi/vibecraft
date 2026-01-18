# Vibecraft Quick Start

## TL;DR

```bash
# Install deps (macOS)
brew install jq tmux

# Configure hooks (once)
npx vibecraft setup

# Run
npx vibecraft
```

Open http://localhost:4003 and use Claude normally.

---

## Not working?

| Problem | Fix |
|---------|-----|
| "jq not found" | `brew install jq` or `apt install jq` |
| "Agent Not Connected" | Is `npx vibecraft` running? Did you run `setup`? |
| No events | Restart Claude Code after setup |
| Wrong port | Default is 4003, check your URL |

## Full guide

See [SETUP.md](./SETUP.md)
