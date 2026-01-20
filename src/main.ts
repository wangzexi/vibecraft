import './styles/index.css'
import { WorkshopScene } from './scene/WorkshopScene'
import { Claude } from './entities/ClaudeMon'
import { SubagentManager } from './entities/SubagentManager'
import { registerAllHandlers } from './events/handlers'
import { processOpencodeEvent } from './events/EventAdapter'
import { subscribeEvents, sessionAPI } from './api/client'
import type { Event, Session, EventMessagePartUpdated, ToolPart } from './types'

const state = {
  scene: null as WorkshopScene | null,
  sessions: new Map(),
  allSessions: [] as Session[],
  soundEnabled: true,
  connected: false,
}

function getOrCreateSession(sessionId: string) {
  if (state.sessions.has(sessionId)) return state.sessions.get(sessionId)
  if (!state.scene) return null

  const zone = state.scene.createZone(sessionId, { hintPosition: undefined })
  if (!zone) return null

  const claude = new Claude(state.scene)
  zone.group.add(claude.mesh)

  const sessionState = {
    claude,
    subagents: new SubagentManager(state.scene),
    zone,
    color: zone.color,
    stats: { toolsUsed: 0, filesTouched: new Set(), activeSubagents: 0 },
  }

  state.sessions.set(sessionId, sessionState)
  return sessionState
}

function handleEvent(event: Event) {
  let sessionId: string | null = null
  if ('properties' in event) {
    const props = event.properties as any
    sessionId = props.sessionID || props.session?.id || null
  }
  if (!sessionId) return

  const session = getOrCreateSession(sessionId)
  if (!session) return

  processOpencodeEvent(event, {
    scene: state.scene,
    feedManager: null,
    timelineManager: null,
    soundEnabled: state.soundEnabled,
    session: {
      id: sessionId,
      color: session.color,
      claude: session.claude,
      subagents: session.subagents,
      zone: session.zone,
      stats: session.stats,
    },
  })

  if (event.type === 'message.part.updated') {
    const e = event as EventMessagePartUpdated
    const part = e.properties.part
    if (part.type === 'tool') {
      const toolPart = part as ToolPart
      if (toolPart.state.status === 'completed') session.stats.toolsUsed++
    }
  }
}

function updateUI() {
  const statusDot = document.getElementById('status-dot')
  const statusText = document.getElementById('connection-status')
  if (statusDot && statusText) {
    statusDot.className = state.connected ? 'connected' : 'disconnected'
    statusText.textContent = state.connected ? 'Connected' : 'Connecting...'
  }

  const container = document.getElementById('managed-sessions')
  if (container) {
    container.innerHTML = state.allSessions.map((s, i) => `
      <div class="session-item">
        ${i < 6 ? `<div class="session-hotkey">${i + 1}</div>` : ''}
        <div class="session-status idle"></div>
        <div class="session-info">
          <div class="session-name">${s.title}</div>
          <div class="session-detail">📁 ${s.directory.split('/').pop()}</div>
        </div>
      </div>
    `).join('')
  }

  const allCount = document.getElementById('all-sessions-count')
  if (allCount) {
    allCount.textContent = `${state.allSessions.length} session${state.allSessions.length !== 1 ? 's' : ''}`
  }
}

async function init() {
  console.log('🚀 Vibecraft starting...')

  state.scene = new WorkshopScene(document.body)
  registerAllHandlers()

  try {
    state.allSessions = await sessionAPI.list()
    console.log(`✅ Loaded ${state.allSessions.length} sessions`)
    updateUI()
  } catch (error) {
    console.error('❌ Failed to load sessions:', error)
  }

  try {
    console.log('📡 Connecting to OpenCode...')
    state.connected = true
    updateUI()
    await subscribeEvents(handleEvent)
  } catch (error) {
    console.error('❌ Connection failed:', error)
    state.connected = false
    updateUI()
    setTimeout(() => init(), 5000)
  }
}

init()
