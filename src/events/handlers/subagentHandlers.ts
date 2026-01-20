import { eventBus } from '../EventBus'
import type { EventMessagePartUpdated, ToolPart } from '@opencode-ai/sdk'

/**
 * Register subagent-related event handlers
 */
export function registerSubagentHandlers(): void {
  // Spawn subagent when Task tool starts
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.session) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.tool !== 'Task' || toolPart.state.status !== 'running') return

    const description = (toolPart.state.input as { description?: string }).description
    ctx.session.subagents.spawn(toolPart.callID, description)
    ctx.session.stats.activeSubagents = ctx.session.subagents.count
  })

  // Remove subagent when Task tool completes
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.session) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.tool !== 'Task') return
    if (toolPart.state.status !== 'completed' && toolPart.state.status !== 'error') return

    ctx.session.subagents.remove(toolPart.callID)
    ctx.session.stats.activeSubagents = ctx.session.subagents.count
  })
}
