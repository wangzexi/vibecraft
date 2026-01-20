import { eventBus } from '../EventBus'
import type { EventSessionStatus } from '@opencode-ai/sdk'

/**
 * Register zone status event handlers
 */
export function registerZoneHandlers(): void {
  // Set attention state when session status changes
  eventBus.on('session.status', (event: EventSessionStatus, ctx) => {
    if (!ctx.session || !ctx.scene) return

    const status = event.properties.status
    
    // Set zone status based on session status
    if (status.type === 'idle') {
      ctx.scene.setZoneAttention(event.properties.sessionID, 'finished')
      ctx.scene.setZoneStatus(event.properties.sessionID, 'attention')
    } else if (status.type === 'busy') {
      ctx.scene.clearZoneAttention(event.properties.sessionID)
      ctx.scene.setZoneStatus(event.properties.sessionID, 'working')
    }
  })
}
