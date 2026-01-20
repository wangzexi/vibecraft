import type {
  Event,
  EventMessagePartUpdated,
  EventSessionCreated,
  EventSessionUpdated,
  EventSessionStatus,
} from '@opencode-ai/sdk'
import type { WorkshopScene } from '../scene/WorkshopScene'

export interface EventContext {
  scene: WorkshopScene | null
  feedManager: any | null
  timelineManager: any | null
  session: SessionContext | null
  soundEnabled: boolean
}

export interface SessionContext {
  id: string
  color: number
  claude: any
  subagents: any
  zone: any
  stats: {
    toolsUsed: number
    filesTouched: Set<string>
    activeSubagents: number
  }
}

export interface EventTypeMap {
  'session.created': EventSessionCreated
  'session.updated': EventSessionUpdated
  'session.status': EventSessionStatus
  'message.part.updated': EventMessagePartUpdated
  'event': Event
}

export type EventType = keyof EventTypeMap

export type EventHandler<T extends EventType> = (
  event: EventTypeMap[T],
  context: EventContext
) => void

export class EventBus {
  private handlers: Map<EventType, Set<EventHandler<any>>> = new Map()

  on<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  emit<T extends EventType>(type: T, event: EventTypeMap[T], context: EventContext): void {
    const handlers = this.handlers.get(type)
    if (!handlers) return

    for (const handler of handlers) {
      try {
        handler(event, context)
      } catch (error) {
        console.error(`EventBus error for ${type}:`, error)
      }
    }
  }
}

export const eventBus = new EventBus()
