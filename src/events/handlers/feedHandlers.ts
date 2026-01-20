import { eventBus } from '../EventBus'
import type { EventMessagePartUpdated, EventSessionStatus, ToolPart } from '@opencode-ai/sdk'

/**
 * Register feed-related event handlers
 */
export function registerFeedHandlers(): void {
  // Hide thinking indicator when tool starts
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.session || !ctx.feedManager) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.state.status !== 'running') return
    
    ctx.feedManager.hideThinking(toolPart.sessionID)
  })

  // Hide thinking indicator on session status change
  eventBus.on('session.status', (event: EventSessionStatus, ctx) => {
    if (!ctx.feedManager) return
    ctx.feedManager.hideThinking(event.properties.sessionID)
  })
}
