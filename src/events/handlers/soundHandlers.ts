/**
 * Sound Event Handlers
 *
 * Registers sound effects for various events.
 * These run via the EventBus, decoupled from main event handling.
 * Includes spatial audio positioning based on session/zone.
 */

import { eventBus } from '../EventBus'
import { soundManager, type SoundPlayOptions } from '../../audio'
import type { EventMessagePartUpdated, ToolPart } from '@opencode-ai/sdk'

/**
 * Check if a Bash command is a git commit
 */
function isGitCommit(command: string): boolean {
  // Match: git commit, git commit -m, git commit --amend, etc.
  // But not: git commit-tree, commented out commands, etc.
  return /\bgit\s+commit\b/.test(command)
}

/**
 * Get spatial options from context (for positional audio)
 */
function getSpatialOptions(ctx: { session: { id: string } | null }): SoundPlayOptions | undefined {
  if (ctx.session?.id) {
    return { zoneId: ctx.session.id }
  }
  return undefined
}

/**
 * Register all sound-related event handlers
 */
export function registerSoundHandlers(): void {
  // Tool start sounds (when message part is updated with running tool)
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.soundEnabled) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.state.status !== 'running') return
    
    const spatial = getSpatialOptions(ctx)
    const toolName = toolPart.tool

    // Special sound for git commit (global, no spatial)
    if (toolName === 'Bash') {
      const input = toolPart.state.input as { command?: string }
      if (input.command && isGitCommit(input.command)) {
        soundManager.play('git_commit')  // Global sound, no spatial
        return  // Skip normal bash sound
      }
    }

    // Spawn sound for Task tool
    if (toolName === 'Task') {
      soundManager.play('spawn', spatial)
    }

    soundManager.playTool(toolName, spatial)
  })

  // Tool completion sounds (success/error)
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.soundEnabled) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.state.status !== 'completed' && toolPart.state.status !== 'error') return
    
    const spatial = getSpatialOptions(ctx)
    const success = toolPart.state.status === 'completed'
    
    soundManager.playResult(success, spatial)

    // Despawn sound for Task tool
    if (toolPart.tool === 'Task') {
      soundManager.play('despawn', spatial)
    }
  })

  // Session status changes
  eventBus.on('session.status', (_event, ctx) => {
    if (!ctx.soundEnabled) return
    const spatial = getSpatialOptions(ctx)
    soundManager.play('stop', spatial)
  })
}
