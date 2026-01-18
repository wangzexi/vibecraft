# Sound System

This document explains Vibecraft's audio architecture, including synthesized sounds and spatial audio positioning.

## Overview

Vibecraft uses **Tone.js** for programmatic sound synthesis. No audio files are needed - all sounds are generated in real-time using Web Audio API.

```
Event (tool use, stop, etc.)
    ↓
EventBus handler (soundHandlers.ts)
    ↓
soundManager.play(name, { zoneId })
    ↓
Calculate spatial params (if positional)
    ↓
Route through Tone.Panner
    ↓
Play synthesized sound
```

## Files

| File | Purpose |
|------|---------|
| `src/audio/SoundManager.ts` | Sound definitions, playback, spatial integration |
| `src/audio/SpatialAudioContext.ts` | Listener tracking, distance/pan calculations |
| `src/audio/index.ts` | Barrel exports |
| `src/events/handlers/soundHandlers.ts` | Event-to-sound mapping |

## Sound Catalog

### Tools (10)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `read` | Read tool | Two-tone sine (A4→C5) |
| `write` | Write tool | Triple square blip (E5, E5, G5) |
| `edit` | Edit tool | Double triangle tap (E4→G4) |
| `bash` | Bash tool | DataBurst - 5 rapid sawtooth blips (C5) |
| `grep` | Grep tool | Sweep with "found it" blip |
| `glob` | Glob tool | Alias for grep |
| `webfetch` | WebFetch tool | Ascending arpeggio (C5→E5→G5→C6) |
| `websearch` | WebSearch tool | Alias for webfetch |
| `task` | Task tool | FM synth sweep (C3→C4) |
| `todo` | TodoWrite tool | Triple checkbox tick (E4, E4, G4) |

### Tool Results (2)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `success` | post_tool_use (success=true) | Rising chime (C5→G5) |
| `error` | post_tool_use (success=false) | Descending buzz (A2→F2) |

### Session Events (4)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `prompt` | user_prompt_submit | Gentle acknowledgment (G4→D5) |
| `stop` | stop event | Completion chord (E4→G4→C5) |
| `thinking` | Claude thinking state | Ambient two-tone (D4, F4) |
| `notification` | notification event | Double ping (A4, A4) |

### Zones (2)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `zone_create` | New zone created | Rising staggered chord (C4→E4→G4→C5) |
| `zone_delete` | Zone removed | Descending minor (G4→Eb4→C4→G3) |

### Subagents (2)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `spawn` | Task tool starts | Ethereal rise (C4→G5) |
| `despawn` | Task tool completes | Ethereal fall (G4→C3) |

### Character (1)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `walking` | Claude moves to station | Soft double footstep (D4, D4) |

### UI Interactions (6)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `click` | Floor click | Soft pop/tap |
| `modal_open` | Modal appears | Soft whoosh up |
| `modal_cancel` | Modal dismissed | Descending tone |
| `modal_confirm` | Modal confirmed | Ascending triad |
| `hover` | Hex grid hover | Distance-based pitch tick |
| `focus` | Camera transition | Quick whoosh/zoom |

### Special (4)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `git_commit` | Bash with `git commit` | Satisfying fanfare (G→B→D→G + shimmer) |
| `intro` | App startup | Jazz Cmaj9 chord bloom |
| `voice_start` | Voice recording starts | Ascending beep (C5→E5) |
| `voice_stop` | Voice recording stops | Descending beep (E5→C5) |

### Draw Mode (1)

| Sound | Trigger | Description |
|-------|---------|-------------|
| `clear` | Clear all painted hexes | Descending sweep |

## Spatial Audio

Sounds can be positioned in 3D space based on their source zone's location relative to the camera.

### Spatial Modes

Each sound has a spatial mode:

| Mode | Behavior | When to Use |
|------|----------|-------------|
| `positional` | Volume/pan affected by distance from camera | Zone-specific events (tools, results) |
| `global` | Always centered, full volume | Celebrations, UI, system events |

### Mode Assignments

**Positional sounds** (affected by distance/pan):
- All tool sounds: `read`, `write`, `edit`, `bash`, `grep`, `glob`, `webfetch`, `websearch`, `task`, `todo`
- Tool results: `success`, `error`
- Session events: `prompt`, `stop`, `thinking`
- Zone events: `zone_create`, `zone_delete`
- Subagents: `spawn`, `despawn`
- Character: `walking`

**Global sounds** (always centered):
- Special: `git_commit`, `intro`
- System: `notification`
- UI: `click`, `modal_open`, `modal_cancel`, `modal_confirm`, `hover`, `focus`
- Voice: `voice_start`, `voice_stop`
- Draw: `clear`

### How Spatial Positioning Works

```
1. Sound triggered with { zoneId: 'session-123' }
2. Resolve zone position via scene.getZoneWorldPosition(zoneId)
3. Calculate distance from camera/listener
4. Calculate angle relative to camera facing direction
5. Apply volume attenuation and stereo panning
6. Play through Tone.Panner node
```

### Volume Calculation

```javascript
volume = 1 / (1 + distance × 0.025)
volume = max(0.3, volume)  // Never below 30%

// Focused zone gets a boost
if (isFocusedZone) volume × 1.25
```

| Distance | Volume |
|----------|--------|
| 0 | 100% |
| 20 | ~67% |
| 40 | ~50% |
| 100 | ~33% |
| 200+ | ~30% (minimum) |

### Pan Calculation

```javascript
angle = atan2(dx, dz) - cameraRotation
pan = sin(angle)
pan = clamp(pan, -0.7, 0.7)  // Not hard left/right
```

### Listener Updates

The listener (camera) position is updated every 100ms:

```typescript
// In main.ts
setInterval(() => {
  soundManager.updateListener(camera.position.x, camera.position.z, camera.rotation.y)
}, 100)
```

### Settings

- **Toggle**: Settings modal checkbox "Spatial Audio"
- **Storage**: `localStorage.getItem('vibecraft-spatial-audio')`
- **Default**: Enabled
- **When disabled**: All sounds play centered at full volume

## Usage

### Basic Playback

```typescript
import { soundManager } from './audio'

// Initialize (must be from user gesture)
await soundManager.init()

// Play by name (global)
soundManager.play('git_commit')

// Play with spatial positioning
soundManager.play('bash', { zoneId: 'session-123' })

// Play tool sound
soundManager.playTool('Read', { zoneId })

// Play result sound
soundManager.playResult(success, { zoneId })
```

### Event Handler Integration

```typescript
// In soundHandlers.ts
eventBus.on('pre_tool_use', (event, ctx) => {
  if (!ctx.soundEnabled) return
  const spatial = ctx.session?.id ? { zoneId: ctx.session.id } : undefined
  soundManager.playTool(event.tool, spatial)
})
```

### Spatial Configuration

```typescript
// Connect zone resolver (once at startup)
soundManager.setZonePositionResolver((zoneId) => {
  return scene.getZoneWorldPosition(zoneId)
})

// Connect focused zone resolver
soundManager.setFocusedZoneResolver(() => {
  return scene.focusedZoneId
})

// Toggle spatial audio
soundManager.setSpatialEnabled(false)
```

## Volume Levels

Sounds use consistent dB levels:

| Level | dB | Use Case |
|-------|-----|----------|
| `QUIET` | -20 | Background/ambient |
| `SOFT` | -16 | Subtle feedback (walking) |
| `NORMAL` | -12 | Standard UI feedback |
| `PROMINENT` | -10 | Important events |
| `LOUD` | -8 | Major events |

## Adding New Sounds

1. Add sound name to `SoundName` type in `SoundManager.ts`
2. Add spatial mode to `SOUND_SPATIAL_MODE` map
3. Add tool mapping to `TOOL_SOUND_MAP` (if it's a tool)
4. Add sound definition to `sounds` object
5. Call from appropriate event handler

Example:

```typescript
// 1. Add to SoundName type
export type SoundName = ... | 'my_new_sound'

// 2. Add spatial mode
const SOUND_SPATIAL_MODE: Record<SoundName, SpatialMode> = {
  ...
  my_new_sound: 'positional',  // or 'global'
}

// 3. Add sound definition
private sounds: Record<SoundName, () => void> = {
  ...
  my_new_sound: () => {
    const synth = this.createDisposableSynth(
      { type: 'sine', attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 },
      VOL.NORMAL
    )
    synth.triggerAttackRelease('C5', '8n')
  },
}
```

## Testing

A test page is available at `/test-spatial.html` when running the dev server. It provides:

- Init button for audio context
- Spatial toggle
- Position grid for testing directional audio
- Global vs positional sound comparison

## Design Philosophy

- **Digital theme**: Clean synth tones, quick response
- **Non-intrusive**: Sounds complement, don't distract
- **Always audible**: Distant sounds are quiet (30% min), never silent
- **Subtle panning**: ±0.7 max, no jarring hard left/right
- **User control**: Toggle in settings, volume slider
