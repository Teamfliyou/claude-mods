export type TaskStatus = 'pending' | 'running' | 'done' | 'error'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  startedAt: number | null
  endedAt: number | null
}

export type ToolRun = {
  id: string
  tool: string
  startedAt: number
  endedAt: number | null
  isError: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'task-progress': {
      tasks: Shaped<Task[]>
      calls: Shaped<ToolRun[]>
      isCollapsed: Shaped<boolean>
      tick: Shaped<number>
      sessionStartedAt: Shaped<number | null>
    }
  }
}
