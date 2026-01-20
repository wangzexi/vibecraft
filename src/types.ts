/**
 * Vibecraft Types
 */

export type {
  Session,
  Event,
  EventSessionCreated,
  EventSessionUpdated,
  EventSessionStatus,
  EventMessagePartUpdated,
  ToolPart,
} from '@opencode-ai/sdk'

export type StationType =
  | 'center' | 'bookshelf' | 'desk' | 'workbench'
  | 'terminal' | 'scanner' | 'antenna' | 'portal' | 'taskboard'

export const TOOL_STATION_MAP: Record<string, StationType> = {
  Read: 'bookshelf',
  Write: 'desk',
  Edit: 'workbench',
  Bash: 'terminal',
  Grep: 'scanner',
  Glob: 'scanner',
  WebFetch: 'antenna',
  WebSearch: 'antenna',
  Task: 'portal',
  TodoWrite: 'taskboard',
  AskUserQuestion: 'center',
  NotebookEdit: 'desk',
}

export function getStationForTool(tool: string): StationType {
  return TOOL_STATION_MAP[tool] ?? 'center'
}
