/**
 * OpenCode Event Adapter
 * 
 * Adapts OpenCode SDK events to Vibecraft's internal event handling.
 */

import type { Event, EventMessagePartUpdated, ToolPart } from '@opencode-ai/sdk'
import { eventBus, type EventContext } from './EventBus'

/**
 * Process OpenCode event and emit to EventBus
 */
export function processOpencodeEvent(event: Event, context: EventContext) {
  // Emit the event to EventBus for handlers
  const eventType = event.type as keyof typeof eventBus['handlers']
  
  try {
    // Handle message part updates (tools)
    if (event.type === 'message.part.updated') {
      eventBus.emit('message.part.updated', event as EventMessagePartUpdated, context)
    }
    // Handle session events
    else if (event.type === 'session.created') {
      eventBus.emit('session.created', event as any, context)
    }
    else if (event.type === 'session.updated') {
      eventBus.emit('session.updated', event as any, context)
    }
    else if (event.type === 'session.status') {
      eventBus.emit('session.status', event as any, context)
    }
    // Generic event handler
    else {
      eventBus.emit('event', event, context)
    }
  } catch (error) {
    console.error('[EventAdapter] Error processing event:', error)
  }
}

/**
 * Extract tool information from message part
 */
export function extractToolInfo(part: any): { tool: string; input: any; status: string } | null {
  if (part.type !== 'tool') return null
  
  const toolPart = part as ToolPart
  return {
    tool: toolPart.tool,
    input: toolPart.state.input,
    status: toolPart.state.status
  }
}
