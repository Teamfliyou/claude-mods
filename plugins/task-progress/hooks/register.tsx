import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Task, ToolRun } from '../types'

const PANE = 'task-progress'
const BOOKKEEPING = new Set(['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList', 'TodoWrite'])

// Change a tag when the fields of its value change: an earlier version's
// stored value is declined instead of misread.
const tasks = atom({ plugin: 'task-progress', key: 'tasks' } as const, [], { shape: 'tasks-1' })
const calls = atom({ plugin: 'task-progress', key: 'calls' } as const, [], { shape: 'calls-1' })
const isCollapsed = atom({ plugin: 'task-progress', key: 'isCollapsed' } as const, false, {
  shape: 'collapsed-1',
})
const tick = atom({ plugin: 'task-progress', key: 'tick' } as const, 0, { shape: 'tick-1' })
const sessionStartedAt = atom({ plugin: 'task-progress', key: 'sessionStartedAt' } as const, null, {
  shape: 'started-1',
})

// One accent colour; the theme keys follow the light or dark theme by themselves.
const ACCENT = 'suggestion'
const TRACK = 'inactive'
const ERROR = 'error'

const LABEL = {
  pending: 'En attente',
  running: 'En cours',
  done: 'Terminée',
  error: 'Erreur',
} as const

const duration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

let timer: { cancel: () => void } | null = null

// The animation clock runs only while something is running, so an idle
// session redraws nothing.
async function sync($: EngineInterface): Promise<void> {
  const t = await read($, tasks)
  const c = await read($, calls)
  const isBusy =
    t.some(x => x.status === 'running' || x.status === 'error') || c.some(x => x.endedAt === null)
  if (isBusy && !timer) {
    timer = $.clock.every(160, () => void update($, tick, n => n + 1))
  } else if (!isBusy && timer) {
    timer.cancel()
    timer = null
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, sessionStartedAt, s => s ?? Date.now())
    await $.command.register({
      name: 'progress',
      description: 'Ouvre ou replie le panneau de progression des tâches',
    })
    void $.ui.open({ id: PANE, title: 'Progression' })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await update($, tasks, () => [])
    await update($, calls, () => [])
    await update($, sessionStartedAt, () => null)
    await sync($)

    return next(e)
  })

  on('command.run', { command: 'progress' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Progression' })
    await update($, isCollapsed, v => !v)

    return { text: 'Panneau de progression basculé.' }
  })

  on('tool.call', async ($, e, next) => {
    const now = await $.clock.now()
    const isBook = BOOKKEEPING.has(e.tool)

    if (!isBook) {
      await update($, sessionStartedAt, s => s ?? now)
      const run: ToolRun = { id: e.tool_use_id, tool: e.tool, startedAt: now, endedAt: null, isError: false }
      await update($, calls, list => [...list, run].slice(-40))
      await sync($)
    }

    const ran = await next(e)
    const end = await $.clock.now()
    const isError = ran.deny !== undefined || ran.isError === true

    // The task list is Claude's own: mirror it, never estimate it.
    if (e.tool === 'TodoWrite' && !isError) {
      const todos = e.todos
      await update($, tasks, old =>
        todos.map((todo, i): Task => {
          const before = old.find(t => t.title === todo.content)
          const status = todo.status === 'completed' ? 'done' : todo.status === 'in_progress' ? 'running' : 'pending'
          return {
            id: before?.id ?? `todo-${i}-${todo.content}`,
            title: todo.content,
            status: status === 'running' && before?.status === 'error' ? 'error' : status,
            startedAt: status === 'pending' ? null : before?.startedAt ?? end,
            endedAt: status === 'done' ? before?.endedAt ?? end : null,
          }
        }),
      )
    }

    if (e.tool === 'TaskCreate' && !isError && ran.result && 'task' in ran.result) {
      const created = ran.result.task
      await update($, tasks, list => [
        ...list,
        { id: String(created.id), title: created.subject, status: 'pending', startedAt: null, endedAt: null },
      ])
    }

    if (e.tool === 'TaskUpdate' && !isError) {
      await update($, tasks, list =>
        list
          .filter(t => !(t.id === e.taskId && e.status === 'deleted'))
          .map(t => {
            if (t.id !== e.taskId) return t
            const title = e.subject ?? t.title
            if (e.status === 'in_progress') return { ...t, title, status: 'running', startedAt: t.startedAt ?? end, endedAt: null }
            if (e.status === 'completed') return { ...t, title, status: 'done', startedAt: t.startedAt ?? end, endedAt: end }
            if (e.status === 'pending') return { ...t, title, status: 'pending', startedAt: null, endedAt: null }
            return { ...t, title }
          }),
      )
    }

    if (!isBook) {
      await update($, calls, list =>
        list.map(r => (r.id === e.tool_use_id ? { ...r, endedAt: end, isError } : r)),
      )
      // A failed tool call marks the running tasks as in error; the next
      // success clears it.
      await update($, tasks, list =>
        list.map(t =>
          isError && t.status === 'running'
            ? { ...t, status: 'error' }
            : !isError && t.status === 'error'
              ? { ...t, status: 'running' }
              : t,
        ),
      )
    }

    await sync($)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    // A turn that ended leaves nothing running: calls still open were cut short.
    const now = await $.clock.now()
    await update($, calls, list => list.map(r => (r.endedAt === null ? { ...r, endedAt: now } : r)))
    await sync($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const list = await read($, tasks)
    const runs = await read($, calls)
    const collapsed = await read($, isCollapsed)
    const n = await read($, tick)
    const startedAt = await read($, sessionStartedAt)
    const now = await $.clock.now()

    const total = list.length
    const done = list.filter(t => t.status === 'done').length
    const failed = list.filter(t => t.status === 'error').length
    const live = runs.filter(r => r.endedAt === null)
    const isActive = live.length > 0 || list.some(t => t.status === 'running' || t.status === 'error')

    // The bar: a known fraction fills the track; an unknown one slides a
    // short segment along it. No fraction is ever guessed.
    // Remote surfaces draw a true rounded bar as SVG (colours that read on
    // both themes); the terminal draws it with rounded line glyphs.
    const isRemote = e.surface !== 'terminal'
    const columns = Math.max(10, e.props.bodyColumns - 2)
    const bar = (pct: number | null, colour: string) => {
      const sweep = (n * 4) % 140 // 0..139, folded to a back-and-forth
      const pos = sweep <= 70 ? sweep : 140 - sweep // 0..70 (% of the track)
      if (isRemote) {
        const W = Math.min(900, Math.max(200, e.props.bodyColumns * 8))
        const H = 6
        const fill = { accent: '#5b8def', error: '#e0706b' }[colour === ERROR ? 'error' : 'accent']
        const seg = pct === null ? W * 0.3 : (W * (pct ?? 0)) / 100
        const x = pct === null ? (W * pos) / 100 : 0
        const rect =
          pct === 0
            ? ''
            : `<rect x="${x.toFixed(1)}" y="0" width="${seg.toFixed(1)}" height="${H}" rx="${H / 2}" fill="${fill}"/>`
        const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="${H / 2}" fill="#808080" fill-opacity="0.25"/>${rect}</svg>`
        return <Svg source={source} alt={pct === null ? 'Progression inconnue' : `${pct}%`} width={W} height={H} />
      }
      const seg = pct === null ? Math.max(3, Math.round(columns * 0.3)) : Math.round((columns * pct) / 100)
      const start = pct === null ? Math.round(((columns - seg) * pos) / 70) : 0
      return (
        <Text>
          <Text color={TRACK}>{'─'.repeat(start)}</Text>
          <Text color={colour}>{'━'.repeat(seg)}</Text>
          <Text color={TRACK}>{'─'.repeat(Math.max(0, columns - start - seg))}</Text>
        </Text>
      )
    }

    // Global bar: known only when a task list exists.
    const globalPct = total > 0 ? Math.round((done / total) * 100) : null
    const globalIndeterminate = total === 0 && isActive
    const globalLabel =
      total > 0
        ? `${done}/${total} · ${globalPct}%`
        : isActive
          ? 'Progression inconnue'
          : 'Aucune tâche'
    const elapsed = startedAt === null ? '' : duration(now - startedAt)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color={failed > 0 ? ERROR : undefined}>
            {failed > 0 ? `${globalLabel} · ${failed} en erreur` : globalLabel}
          </Text>
          <Box gap={1}>
            <Text dimColor>{elapsed}</Text>
            <Button
              key="toggle"
              label={collapsed ? '▸' : '▾'}
              onPress={() => update($, isCollapsed, v => !v)}
            />
          </Box>
        </Box>
        {bar(globalIndeterminate ? null : (globalPct ?? 0), failed > 0 ? ERROR : ACCENT)}

        {!collapsed &&
          list.map(t => {
            const spent = t.startedAt === null ? '' : duration((t.endedAt ?? now) - t.startedAt)
            // Finished tasks shrink to a single quiet line.
            if (t.status === 'done') {
              return (
                <Box key={t.id} justifyContent="space-between">
                  <Text dimColor>✓ {t.title}</Text>
                  <Text dimColor>{spent}</Text>
                </Box>
              )
            }
            const colour = t.status === 'error' ? ERROR : ACCENT
            const pct = t.status === 'pending' ? 0 : null
            const note = pct === null ? `${LABEL[t.status]} · ${spent}` : LABEL[t.status]
            return (
              <Box key={t.id} flexDirection="column" marginTop={1}>
                <Box justifyContent="space-between">
                  <Text color={t.status === 'error' ? ERROR : undefined} dimColor={t.status === 'pending'}>
                    {t.title}
                  </Text>
                  <Text dimColor color={t.status === 'error' ? ERROR : undefined}>
                    {note}
                  </Text>
                </Box>
                {bar(pct, colour)}
              </Box>
            )
          })}

        {!collapsed &&
          live.map(r => (
            <Box key={r.id} flexDirection="column" marginTop={1}>
              <Box justifyContent="space-between">
                <Text dimColor>{r.tool}</Text>
                <Text dimColor>{duration(now - r.startedAt)}</Text>
              </Box>
              {bar(null, ACCENT)}
            </Box>
          ))}
      </Box>
    )
  })
}
