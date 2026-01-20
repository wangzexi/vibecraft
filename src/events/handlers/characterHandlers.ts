/**
 * Character Movement Event Handlers
 *
 * Handles Claude character movement in response to tool use events.
 * Moves character to appropriate stations and sets context labels.
 */

import { eventBus } from '../EventBus'
import { soundManager } from '../../audio'
import { getToolContext } from '../../utils/ToolUtils'
import { getStationForTool } from '../../types'
import type { EventMessagePartUpdated, EventSessionStatus, ToolPart } from '@opencode-ai/sdk'

/**
 * Register character movement event handlers
 */
export function registerCharacterHandlers(): void {
  // Move character to station when tool starts
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.session) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.state.status !== 'running') return

    const station = getStationForTool(toolPart.tool)

    // Move character to station (skip 'center' - those are MCP browser tools)
    if (station !== 'center') {
      const zoneStation = ctx.session.zone.stations.get(station)
      if (zoneStation) {
        ctx.session.claude.moveToPosition(zoneStation.position, station)
        // Play walking sound
        if (ctx.soundEnabled) {
          soundManager.play('walking')
        }
      }
    }

    // Set context text above station
    if (ctx.scene && station !== 'center') {
      const context = getToolContext(toolPart.tool, toolPart.state.input)
      if (context) {
        ctx.scene.setStationContext(station, context, toolPart.sessionID)
      }

      // Pulse station ring to highlight activity
      ctx.scene.pulseStation(toolPart.sessionID, station)
    }
  })

  // Set idle state when tool completes
  eventBus.on('message.part.updated', (event: EventMessagePartUpdated, ctx) => {
    if (!ctx.session) return
    
    const part = event.properties.part
    if (part.type !== 'tool') return
    
    const toolPart = part as ToolPart
    if (toolPart.state.status !== 'completed' && toolPart.state.status !== 'error') return

    // Only set idle if character isn't walking
    if (ctx.session.claude.state !== 'walking') {
      ctx.session.claude.setState('idle')
    }
  })

  // Move character back to center when session status changes
  eventBus.on('session.status', (event: EventSessionStatus, ctx) => {
    if (!ctx.session || !ctx.scene) return

    // Move to zone center
    const centerStation = ctx.session.zone.stations.get('center')
    if (centerStation) {
      ctx.session.claude.moveToPosition(centerStation.position, 'center')
    }

    // Clear station context labels
    ctx.scene.clearAllContexts(event.properties.sessionID)
  })
}
