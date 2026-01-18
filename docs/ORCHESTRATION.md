# Vibecraft Orchestration

Orchestration lets you run multiple Claude Code instances and direct work to each one from a single web UI.

## Quick Start

1. Start vibecraft server: `npm run server`
2. Open the web UI
3. Click **"+ New"** in the Sessions panel to spawn a Claude
4. Click on a session to select it as the prompt target
5. Type a prompt and send - it goes to the selected session

## Concepts

### Managed Sessions

A **managed session** is a Claude Code instance that vibecraft spawned and controls:

- Has a user-friendly name ("Frontend", "Tests", etc.)
- Tracked status: `idle`, `working`, `offline`
- Shows current tool when working
- Can receive prompts from the web UI

### Legacy Mode

If you're running Claude Code in a tmux session called `claude` (the default), vibecraft can observe and prompt it, but it won't appear in the managed sessions list. This is "legacy mode" - it works but isn't part of orchestration.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Vibecraft Server                          │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Session 1  │  │  Session 2  │  │  Session 3  │  ...     │
│  │ "Frontend"  │  │   "Tests"   │  │  "Refactor" │          │
│  │             │  │             │  │             │          │
│  │ tmux:       │  │ tmux:       │  │ tmux:       │          │
│  │ vibecraft-   │  │ vibecraft-   │  │ vibecraft-   │          │
│  │ a1b2c3d4    │  │ e5f6g7h8    │  │ i9j0k1l2    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  WebSocket: broadcasts session updates to UI                 │
│  REST API: create, list, update, delete sessions             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       Web UI                                  │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ Sessions              [+ New]       │                     │
│  │ ┌─────────────────────────────────┐ │                     │
│  │ │ ● Frontend          ✏️ 🗑️       │ │  ← Click to select │
│  │ │   Ready                         │ │                     │
│  │ ├─────────────────────────────────┤ │                     │
│  │ │ ◐ Tests             ✏️ 🗑️       │ │  ← Working         │
│  │ │   Using Bash                    │ │                     │
│  │ └─────────────────────────────────┘ │                     │
│  └─────────────────────────────────────┘                     │
│                                                              │
│  Prompt: [________________________] [Send]                   │
│          → Frontend                                          │
└──────────────────────────────────────────────────────────────┘
```

## REST API

### List Sessions
```bash
GET /sessions

# Response
{
  "ok": true,
  "sessions": [
    {
      "id": "uuid",
      "name": "Frontend",
      "tmuxSession": "vibecraft-a1b2c3d4",
      "status": "idle",
      "createdAt": 1234567890,
      "lastActivity": 1234567890,
      "cwd": "/path/to/project"
    }
  ]
}
```

### Create Session
```bash
POST /sessions
Content-Type: application/json

{"name": "Frontend"}  # name is optional, defaults to "Claude N"

# Response
{
  "ok": true,
  "session": { ... }
}
```

### Rename Session
```bash
PATCH /sessions/:id
Content-Type: application/json

{"name": "New Name"}

# Response
{
  "ok": true,
  "session": { ... }
}
```

### Delete Session
```bash
DELETE /sessions/:id

# Response
{"ok": true}
```

### Send Prompt to Session
```bash
POST /sessions/:id/prompt
Content-Type: application/json

{"prompt": "Write a test for the login function"}

# Response
{"ok": true}
```

### Cancel Session (Ctrl+C)
```bash
POST /sessions/:id/cancel

# Response
{"ok": true}
```

## WebSocket Messages

The server broadcasts session updates via WebSocket:

```typescript
// Full session list (on connect and after changes)
{ type: 'sessions', payload: ManagedSession[] }

// Single session update
{ type: 'session_update', payload: ManagedSession }
```

## Session Status

| Status | Meaning |
|--------|---------|
| `idle` | Ready for prompts, not currently working |
| `working` | Executing a tool (shows which tool) |
| `offline` | tmux session died or was killed externally |

## Hooks Integration

For managed sessions to report events back to vibecraft, Claude Code hooks must be configured globally. The hooks send events to the vibecraft server, which then:

1. Updates the session's `status` and `currentTool`
2. Broadcasts the update to all connected UI clients
3. Shows the activity in the 3D visualization

## Future Ideas

- **Templates**: Pre-configured session types ("Test Runner", "Code Reviewer")
- **Workflows**: Chain prompts across multiple sessions
- **Auto-scaling**: Spawn sessions based on workload
- **Session Groups**: Organize related sessions together
