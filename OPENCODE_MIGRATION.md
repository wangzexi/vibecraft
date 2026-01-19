# Vibecraft → OpenCode 原生改造计划

## 项目概述

将 Vibecraft 彻底改造为 OpenCode 生态的原生组件 - 就像它从一开始就是为 OpenCode 设计的一样。

### 改造理念

**不是适配，而是原生**
- ❌ 不要事件转换层/adapter
- ❌ 不要类型映射
- ❌ 不要独立的 vibecraft 服务器
- ✅ 直接使用 OpenCode 的类型系统
- ✅ 直接处理 OpenCode 的事件
- ✅ 作为独立项目，通过 HTTP API 通信

### 当前架构
```
Claude Code → Hook Script → Vibecraft Server (WebSocket) → 前端 (Three.js)
                ↓
            tmux 会话管理
```

### 目标架构
```
┌─────────────────┐         HTTP API + SSE          ┌──────────────────┐
│ OpenCode Server │ ←──────────────────────────────→ │ Vibecraft (独立) │
│  (localhost:3000)│                                  │  (localhost:4002)│
└─────────────────┘                                  └──────────────────┘
        ↓                                                      ↓
   GlobalBus 事件                                    直接使用 OpenCode 类型
   Session 管理                                      订阅 SSE 事件流
   HTTP API                                          Three.js 3D 可视化
```

**独立运行，原生集成**
- Vibecraft 作为独立项目，有自己的仓库和部署
- 通过 `@opencode/sdk` npm 包使用 OpenCode 类型
- 通过 HTTP API 和 SSE 与 OpenCode server 通信
- 无需成为 monorepo 的一部分

## 改造目标

### 核心目标
- ✅ 作为独立项目，通过 HTTP API 与 OpenCode 通信
- ✅ 直接使用 OpenCode 的类型定义（通过 npm 包）
- ✅ 直接订阅 OpenCode 的 SSE 事件流（无中间层）
- ✅ 直接使用 OpenCode 的 Session 数据结构
- ✅ 保留文明六风格的 3D 可视化界面
- ✅ 可以独立开发、部署和版本管理

### 技术优势
- **零适配成本**: 直接使用 OpenCode 的类型，无需维护映射
- **实时同步**: 直接订阅 SSE 事件流，与 webui 看到相同的事件
- **类型安全**: TypeScript 类型完全对齐，编译时检查
- **独立部署**: 可以独立于 OpenCode 部署和更新
- **灵活开发**: 不受 monorepo 约束，开发更灵活

## 技术方案

### 1. 项目结构（独立项目）

#### 目录结构
```
vibecraft/                    # 独立项目
├── src/
│   ├── scene/               # Three.js 场景
│   ├── entities/            # 3D 角色
│   ├── events/              # 事件处理
│   ├── ui/                  # UI 组件
│   ├── api/                 # OpenCode API 客户端
│   └── main.ts              # 入口
├── package.json
├── vite.config.ts
└── tsconfig.json
```

#### package.json
```json
{
  "name": "vibecraft",
  "version": "0.2.0",
  "type": "module",
  "dependencies": {
    "@opencode/sdk": "^0.1.0",    // 通过 npm 安装
    "three": "^0.160.0",
    "tone": "^15.0.4"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0"
  }
}
```

**关键点**:
- 不是 workspace 依赖，而是 npm 依赖
- 通过 npm 安装 `@opencode/sdk`
- 完全独立的项目结构

### 2. 类型系统 - 直接导入

**完全移除 shared/types.ts，直接使用 OpenCode SDK 的类型**

```typescript
// src/types.ts - 只定义 3D 可视化特有的类型
import type { Session, SessionStatus, Message, Part } from '@opencode/sdk'

// 直接使用 OpenCode 的类型（通过 npm 包）
export type { Session, SessionStatus, Message, Part }

// 只定义 vibecraft 特有的 UI 状态
export interface ZoneUIState {
  sessionId: string
  position: { q: number; r: number }  // 十六进制坐标
  currentStation?: StationType
  lastActivity: number
}

export type StationType =
  | 'center' | 'bookshelf' | 'desk' | 'workbench'
  | 'terminal' | 'scanner' | 'antenna' | 'portal' | 'taskboard'

// 工具到工作站的映射
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
}
```

**关键点**:
- 从 `@opencode/sdk` npm 包导入类型
- 不需要访问 OpenCode 的源码
- 类型定义随 SDK 版本自动更新

### 3. 事件系统 - 直接订阅 SSE

**完全移除事件转换层，通过 SSE 直接接收 OpenCode 事件**

```typescript
// src/api/events.ts - 订阅 OpenCode 的 SSE 事件流
import { createOpencodeClient } from '@opencode/sdk'

const client = createOpencodeClient({
  baseUrl: 'http://localhost:3000'
})

// 直接订阅 SSE 事件
export function subscribeEvents(handler: (event: any) => void) {
  return client.event.listen(handler)
}
```

```typescript
// src/events/handlers/toolHandlers.ts - 直接处理 OpenCode 事件
import type { EventContext } from './types'

export function registerToolHandlers(ctx: EventContext) {
  // 直接处理 tool.started 事件（不是 pre_tool_use）
  ctx.eventBus.on('tool.started', (event) => {
    const { sessionId, toolName, input } = event.properties
    const zone = ctx.scene.getZone(sessionId)
    if (!zone) return

    // 移动角色到对应工作站
    const station = TOOL_STATION_MAP[toolName] || 'center'
    zone.claude.moveTo(station)

    // 播放音效
    if (ctx.soundEnabled) {
      ctx.soundManager.playTool(toolName, { zoneId: sessionId })
    }
  })

  // 直接处理 tool.completed 事件（不是 post_tool_use）
  ctx.eventBus.on('tool.completed', (event) => {
    const { sessionId, toolName, success } = event.properties

    // 播放结果音效
    if (ctx.soundEnabled) {
      ctx.soundManager.playResult(success, { zoneId: sessionId })
    }

    // 显示通知
    ctx.scene.zoneNotifications.showForTool(sessionId, toolName)
  })
}
```

**关键点**:
- 通过 HTTP SSE 订阅事件，不需要访问 GlobalBus
- 事件类型和数据结构与 OpenCode 完全一致
- 无任何转换层或映射代码

### 4. 会话管理 - 直接使用

**直接使用 OpenCode 的 Session 类型，无需自定义结构**

```typescript
// src/session/manager.ts
import type { Session, SessionStatus } from '@opencode/opencode'
import type { ZoneUIState } from '../types'

export class SessionManager {
  // OpenCode 的会话数据（来自 GlobalBus）
  private sessions = new Map<string, Session>()

  // 只维护 3D 可视化特有的 UI 状态
  private zoneStates = new Map<string, ZoneUIState>()

  // 直接使用 OpenCode 的会话数据
  addSession(session: Session) {
    this.sessions.set(session.id, session)

    // 为新会话分配 3D 位置
    this.zoneStates.set(session.id, {
      sessionId: session.id,
      position: this.allocatePosition(),
      lastActivity: Date.now()
    })
  }

  updateSession(session: Session) {
    this.sessions.set(session.id, session)
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getZoneState(id: string): ZoneUIState | undefined {
    return this.zoneStates.get(id)
  }

  // 分配十六进制网格位置
  private allocatePosition(): { q: number; r: number } {
    const index = this.zoneStates.size
    return indexToHexCoord(index)
  }
}
```

### 5. 通信层 - 直接连接

**直接连接到 OpenCode server，无需独立服务器**

```typescript
// src/api/client.ts
import { createOpencodeClient } from '@opencode/sdk'

// 创建全局客户端
export const client = createOpencodeClient({
  baseUrl: import.meta.env.VITE_OPENCODE_URL || 'http://localhost:3000'
})

// 订阅 SSE 事件流
export function subscribeEvents(handler: (event: any) => void) {
  return client.event.listen(handler)
}

// 会话操作
export const sessionAPI = {
  async list() {
    return client.session.list()
  },

  async create(directory: string) {
    return client.session.create({ directory })
  },

  async sendMessage(sessionId: string, content: string) {
    return client.session.message.create(sessionId, {
      content,
      stream: true
    })
  },

  async abort(sessionId: string) {
    return client.session.abort(sessionId)
  }
}

// 权限和问题
export const interactionAPI = {
  async replyPermission(requestId: string, response: string) {
    return client.permission.reply(requestId, { response })
  },

  async replyQuestion(requestId: string, answers: Record<string, string>) {
    return client.question.reply(requestId, { answers })
  }
}
```

### 6. 主入口 - 原生集成

```typescript
// src/main.ts
import { subscribeEvents, sessionAPI, interactionAPI } from './api/client'
import type { BusEvent } from '@opencode/opencode/bus'
import { WorkshopScene } from './scene/WorkshopScene'
import { SessionManager } from './session/manager'
import { SoundManager } from './audio/SoundManager'

// 初始化
const scene = new WorkshopScene()
const sessionManager = new SessionManager()
const soundManager = new SoundManager()

// 订阅 OpenCode 事件（直接处理，无转换）
subscribeEvents((event: BusEvent) => {
  switch (event.type) {
    case 'session.created': {
      const session = event.properties.session
      sessionManager.addSession(session)
      scene.createZone(session.id, sessionManager.getZoneState(session.id)!)
      break
    }

    case 'session.updated': {
      const session = event.properties.session
      sessionManager.updateSession(session)
      scene.updateZone(session.id, session)
      break
    }

    case 'tool.started': {
      const { sessionId, toolName } = event.properties
      const zone = scene.getZone(sessionId)
      if (zone) {
        const station = TOOL_STATION_MAP[toolName] || 'center'
        zone.claude.moveTo(station)
        soundManager.playTool(toolName, { zoneId: sessionId })
      }
      break
    }

    case 'tool.completed': {
      const { sessionId, toolName, success } = event.properties
      soundManager.playResult(success, { zoneId: sessionId })
      scene.zoneNotifications.showForTool(sessionId, toolName)
      break
    }

    case 'permission.asked': {
      const { requestId, sessionId, tool, context } = event.properties
      showPermissionModal({ requestId, sessionId, tool, context })
      break
    }

    case 'question.asked': {
      const { requestId, sessionId, questions } = event.properties
      showQuestionModal({ requestId, sessionId, questions })
      break
    }
  }
})

// 加载现有会话
async function loadSessions() {
  const sessions = await sessionAPI.list()
  for (const session of sessions) {
    sessionManager.addSession(session)
    scene.createZone(session.id, sessionManager.getZoneState(session.id)!)
  }
}

loadSessions()
```

### 7. 构建配置 - 统一技术栈

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@opencode/opencode': resolve(__dirname, '../opencode/src'),
      '@opencode/sdk': resolve(__dirname, '../sdk/js/src')
    }
  },
  server: {
    port: 4002,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

## 实施步骤

### 阶段 1: 安装 SDK 和清理

**目标**: 安装 OpenCode SDK，移除旧的服务器代码

1. **安装 OpenCode SDK**
   ```bash
   cd vibecraft
   npm install @opencode/sdk
   # 或
   bun add @opencode/sdk
   ```

2. **删除旧代码**
   ```bash
   rm -rf server/          # 删除 vibecraft 服务器
   rm -rf hooks/           # 删除 hook 脚本
   rm -rf shared/          # 删除旧的类型定义
   ```

3. **验证 SDK**
   ```typescript
   // 测试导入
   import { createOpencodeClient } from '@opencode/sdk'
   import type { Session } from '@opencode/sdk'
   ```

**验收标准**:
- ✅ `@opencode/sdk` 安装成功
- ✅ 可以导入 SDK 的类型和函数
- ✅ 旧代码已删除

**关键点**:
- SDK 从 npm 安装，不需要 opencode 源码
- 获得完整的类型定义和 API 客户端
- 无需任何构建配置

### 阶段 2: 类型系统改造

**目标**: 使用 SDK 的类型定义，移除所有转换代码

1. **创建新的 types.ts**
   ```typescript
   // src/types.ts
   import type { Session, SessionStatus } from '@opencode/sdk'

   export type { Session, SessionStatus }

   // 只定义 vibecraft 特有的类型
   export interface ZoneUIState {
     sessionId: string
     position: { q: number; r: number }
     currentStation?: StationType
   }
   ```

2. **更新所有导入**
   - 全局搜索替换旧的类型导入
   - 删除所有 `convertXXX` 函数
   - 删除事件映射表

3. **验证类型**
   ```bash
   npm run type-check
   # 或
   tsc --noEmit
   ```

**验收标准**:
- ✅ 无类型错误
- ✅ 无 adapter/converter 代码
- ✅ 所有类型来自 `@opencode/sdk`

**关键点**:
- 类型定义随 SDK 版本自动更新
- 编译时类型检查，无运行时转换
- 与 OpenCode 类型完全一致

### 阶段 3: 事件系统改造

**目标**: 通过 SDK 订阅 SSE 事件，直接处理

1. **创建 API 客户端**
   ```typescript
   // src/api/client.ts
   import { createOpencodeClient } from '@opencode/sdk'

   export const client = createOpencodeClient({
     baseUrl: 'http://localhost:3000'
   })

   export function subscribeEvents(handler: (event: any) => void) {
     return client.event.listen(handler)
   }
   ```

2. **更新事件处理器**
   - 直接处理 `tool.started` 而不是 `pre_tool_use`
   - 直接处理 `tool.completed` 而不是 `post_tool_use`
   - 删除所有事件转换逻辑

3. **测试事件流**
   ```bash
   # 终端 1: 启动 opencode server
   cd /path/to/opencode
   bun run dev

   # 终端 2: 启动 vibecraft
   cd /path/to/vibecraft
   bun run dev
   ```

**验收标准**:
- ✅ 能够接收 SSE 事件
- ✅ 事件处理器正确触发
- ✅ 无事件转换代码

**关键点**:
- SDK 自动处理 SSE 连接和重连
- 事件格式与 OpenCode 完全一致
- 两个项目独立运行，通过 HTTP 通信

### 阶段 4: 会话管理改造

**目标**: 使用 SDK 的 API 管理会话

1. **更新 SessionManager**
   ```typescript
   // src/session/manager.ts
   import type { Session } from '@opencode/sdk'
   import { client } from '../api/client'

   export class SessionManager {
     private sessions = new Map<string, Session>()

     async loadSessions() {
       const sessions = await client.session.list()
       sessions.forEach(s => this.sessions.set(s.id, s))
     }

     async createSession(directory: string) {
       const session = await client.session.create({ directory })
       this.sessions.set(session.id, session)
       return session
     }

     async sendMessage(sessionId: string, content: string) {
       return client.session.message.create(sessionId, {
         content,
         stream: true
       })
     }
   }
   ```

2. **移除 tmux 相关代码**
   - 删除所有 tmux 集成
   - 删除权限提示检测
   - 删除 shell 命令执行

3. **测试会话操作**
   - 创建会话
   - 发送消息
   - 查看响应

**验收标准**:
- ✅ 能够创建和管理会话
- ✅ 能够发送消息
- ✅ 会话状态正确同步

**关键点**:
- 所有操作通过 SDK 的 HTTP API
- 无需直接访问 OpenCode 内部
- 会话数据与 OpenCode 完全一致

### 阶段 5: UI 和交互

**目标**: 完善用户交互和 3D 可视化

1. **权限和问题处理**
   - 监听 `permission.asked` 事件
   - 监听 `question.asked` 事件
   - 使用 OpenCode API 响应

2. **3D 场景优化**
   - 保持现有的 Three.js 场景
   - 保持文明六风格
   - 优化性能

3. **音效系统**
   - 保持 Tone.js 音效
   - 根据 OpenCode 事件触发

**验收标准**:
- ✅ 权限和问题正确处理
- ✅ 3D 场景流畅运行
- ✅ 音效正常播放

### 阶段 6: 测试和文档

**目标**: 确保稳定性和可维护性

1. **集成测试**
   - 多会话并发
   - 事件流完整性
   - 错误处理

2. **文档更新**
   - 更新 README
   - 添加开发指南
   - 添加架构文档

3. **性能优化**
   - 事件处理性能
   - 3D 渲染性能
   - 内存使用

**验收标准**:
- ✅ 所有功能正常工作
- ✅ 文档完整清晰
- ✅ 性能达标

## 技术优势

### 1. 零适配成本

**直接使用 OpenCode 类型**
```typescript
// ✅ 原生方式 - 无需转换
import type { Session, BusEvent } from '@opencode/opencode'

function handleSession(session: Session) {
  // 直接使用，TypeScript 类型完全对齐
  console.log(session.id, session.directory, session.status)
}

// ❌ 适配方式 - 需要维护映射
function convertSession(opencodeSession: OpencodeSession): VibecraftSession {
  return {
    id: opencodeSession.id,
    directory: opencodeSession.cwd,
    // ... 大量映射代码
  }
}
```

### 2. 实时同步

**与 webui 看到相同的事件**
- Vibecraft 和 webui 订阅同一个 GlobalBus
- 事件完全一致，无延迟，无丢失
- 状态自动同步，无需手动协调

### 3. 类型安全

**编译时检查**
```typescript
// OpenCode 更新事件类型时，vibecraft 会立即得到类型错误提示
subscribeEvents((event: BusEvent) => {
  if (event.type === 'tool.started') {
    // TypeScript 知道 event.properties 的确切类型
    const { sessionId, toolName, input } = event.properties
  }
})
```

### 4. 统一生态

**共享技术栈**
- 相同的构建工具 (Vite)
- 相同的包管理器 (pnpm)
- 相同的 TypeScript 配置
- 相同的代码风格

## 关键差异对比

| 方面 | 适配方式 | 原生方式 |
|------|---------|---------|
| 类型定义 | 自定义 + 转换 | 直接导入 OpenCode 类型 |
| 事件处理 | 映射层 (pre_tool_use → tool.started) | 直接处理 tool.started |
| 数据结构 | 自定义 ManagedSession | 直接使用 Session |
| 通信层 | 独立 WebSocket 服务器 | OpenCode SDK |
| 代码维护 | 需要跟随 OpenCode 更新映射 | 自动跟随 OpenCode 更新 |
| 类型安全 | 运行时转换，可能出错 | 编译时检查 |
| 项目结构 | 独立项目 | Monorepo package |

## OpenCode 事件参考

### 会话事件

```typescript
// session.created
{
  type: 'session.created',
  properties: {
    session: Session  // 完整的会话对象
  }
}

// session.updated
{
  type: 'session.updated',
  properties: {
    session: Session
  }
}

// session.deleted
{
  type: 'session.deleted',
  properties: {
    sessionId: string
  }
}
```

### 工具事件

```typescript
// tool.started
{
  type: 'tool.started',
  properties: {
    sessionId: string
    messageId: string
    partId: string
    toolName: string
    input: Record<string, any>
  }
}

// tool.completed
{
  type: 'tool.completed',
  properties: {
    sessionId: string
    messageId: string
    partId: string
    toolName: string
    success: boolean
    output?: any
    error?: string
  }
}
```

### 消息事件

```typescript
// message.created
{
  type: 'message.created',
  properties: {
    sessionId: string
    message: Message
  }
}

// message.updated
{
  type: 'message.updated',
  properties: {
    sessionId: string
    message: Message
  }
}
```

### 交互事件

```typescript
// permission.asked
{
  type: 'permission.asked',
  properties: {
    requestId: string
    sessionId: string
    tool: string
    context: string
    options: string[]
  }
}

// question.asked
{
  type: 'question.asked',
  properties: {
    requestId: string
    sessionId: string
    questions: Question[]
  }
}
```

## 技术风险和挑战

### 挑战 1: Monorepo 依赖管理

**问题**: Workspace 依赖可能导致循环依赖

**解决方案**:
- Vibecraft 只依赖 `@opencode/opencode` 和 `@opencode/sdk`
- 不要让 opencode 依赖 vibecraft
- 保持单向依赖关系

### 挑战 2: 事件类型完整性

**问题**: 需要确保处理所有相关的 OpenCode 事件

**解决方案**:
- 使用 TypeScript 的 discriminated union
- 添加 default case 处理未知事件
- 定期检查 OpenCode 的事件定义更新

### 挑战 3: 3D 场景性能

**问题**: 多会话可能导致 3D 渲染性能下降

**解决方案**:
- 实现视锥剔除，只渲染可见区域
- 使用 LOD (Level of Detail) 系统
- 限制同时显示的会话数量
- 优化几何体和材质

### 挑战 4: 状态同步一致性

**问题**: 前端状态可能与后端不一致

**解决方案**:
- 定期从 API 拉取完整状态
- 实现乐观更新 + 回滚机制
- 添加状态一致性检查

## 依赖关系

### Workspace 依赖
```json
{
  "dependencies": {
    "@opencode/opencode": "workspace:*",
    "@opencode/sdk": "workspace:*",
    "three": "^0.160.0",
    "tone": "^15.0.4"
  }
}
```

### 前置条件
- OpenCode monorepo 环境
- pnpm 包管理器
- Node.js 18+
- 支持 WebGL 的浏览器

### 运行时依赖
- OpenCode server 运行在 localhost:3000
- GlobalBus 事件系统可用
- Session API 可访问

## 成功标准

### 原生集成度
- ✅ 无任何 adapter/converter 代码
- ✅ 直接使用 OpenCode 类型定义
- ✅ 直接订阅 GlobalBus 事件
- ✅ 与 webui 共享相同的技术栈

### 功能完整性
- ✅ 所有原有功能都能正常工作
- ✅ 支持多会话并发
- ✅ 支持不同目录的会话隔离
- ✅ 权限和问题处理正常

### 性能指标
- ✅ 事件延迟 < 50ms（无转换层）
- ✅ 3D 渲染帧率 > 30fps
- ✅ 内存占用合理
- ✅ 类型检查无错误

### 代码质量
- ✅ 代码结构清晰
- ✅ 完全类型安全
- ✅ 易于维护
- ✅ 符合 OpenCode 代码风格

## 后续优化方向

### 功能增强
- **MCP 工具可视化**: 为 MCP 工具添加专门的工作站
- **多模型切换**: 可视化不同 AI 模型的使用
- **LSP 诊断**: 显示代码诊断信息
- **性能监控**: 实时显示 token 使用、API 延迟等

### 体验优化
- **更多动画**: 添加更丰富的角色动画
- **音效系统**: 扩展音效库，支持自定义音效
- **自定义主题**: 支持用户自定义颜色和样式
- **快捷键**: 完善快捷键系统

### 技术优化
- **虚拟滚动**: 优化大量会话的渲染
- **Web Worker**: 将事件处理移到 Worker
- **离线缓存**: 支持离线查看历史会话
- **资源优化**: 优化 3D 模型和纹理加载

### 与 OpenCode 深度集成
- **共享 UI 组件**: 使用 `@opencode/ui` 组件库
- **统一配置**: 共享 OpenCode 的配置系统
- **插件系统**: 作为 OpenCode 的可选插件
- **主题同步**: 与 webui 共享主题设置

## 启动和开发

### 开发环境

```bash
# 1. 启动 OpenCode server (独立运行)
cd /path/to/opencode
bun run dev
# OpenCode server 运行在 http://localhost:3000

# 2. 启动 Vibecraft (独立运行，新终端)
cd /path/to/vibecraft
bun install              # 安装依赖（包括 @opencode/sdk）
bun run dev
# Vibecraft 运行在 http://localhost:4002

# 3. 访问
open http://localhost:4002
```

### 生产构建

```bash
# 构建 vibecraft
cd /path/to/vibecraft
bun run build

# 预览构建结果
bun run preview
```

### 环境变量

```bash
# .env
VITE_OPENCODE_URL=http://localhost:3000
```

## 依赖关系

### NPM 依赖
```json
{
  "dependencies": {
    "@opencode/sdk": "^0.1.0",    // 从 npm 安装
    "three": "^0.160.0",
    "tone": "^15.0.4"
  }
}
```

### 运行时依赖
- OpenCode server 运行在 localhost:3000
- HTTP API 可访问
- SSE 事件流可用

### 前置条件
- Node.js 18+
- Bun 或 npm
- 支持 WebGL 的浏览器
- OpenCode server 已启动

**关键点**:
- Vibecraft 和 OpenCode 完全独立运行
- 只通过 HTTP API 和 SSE 通信
- 不需要 OpenCode 源码，只需要 SDK npm 包

## 参考资料

### OpenCode SDK
- **npm 包**: https://www.npmjs.com/package/@opencode/sdk
- **类型定义**: 随 SDK 包提供
- **API 文档**: SDK 包内的 README

### Vibecraft 源码
- **3D 场景**: `/src/scene/`
- **角色系统**: `/src/entities/`
- **事件处理**: `/src/events/`
- **UI 组件**: `/src/ui/`

### 技术文档
- **Three.js**: https://threejs.org/docs/
- **Tone.js**: https://tonejs.github.io/
- **Vite**: https://vitejs.dev/
- **TypeScript**: https://www.typescriptlang.org/

### OpenCode 文档
- **HTTP API**: OpenCode server 的 API 文档
- **事件系统**: SDK 包内的事件类型定义
- **WebUI**: 参考 OpenCode webui 的实现

---

## 总结

这个改造计划的核心理念是**独立项目 + 原生集成**：

1. **独立运行**: Vibecraft 和 OpenCode 作为独立项目运行
2. **SDK 集成**: 通过 npm 安装 `@opencode/sdk`，获得完整类型和客户端
3. **HTTP 通信**: 通过 HTTP API 和 SSE 与 OpenCode 通信
4. **无转换层**: 直接使用 OpenCode 的类型和事件，无任何 adapter

**改造步骤简化为**:
1. 安装 `@opencode/sdk` (npm install)
2. 删除旧的 server、hooks、shared 代码
3. 更新类型导入（从 SDK）
4. 更新事件处理（直接处理 OpenCode 事件）
5. 更新 API 调用（使用 SDK 客户端）

**最终效果**:
- Vibecraft 就像从一开始就是为 OpenCode 设计的
- 无需 OpenCode 源码，只需要 SDK npm 包
- 两个项目独立开发、部署、版本管理
- 通过标准的 HTTP API 通信

---

**文档版本**: 2.1 (独立项目 + 原生集成版)
**创建日期**: 2026-01-20
**最后更新**: 2026-01-20
**负责人**: @zexi
