import { statSync, readdirSync } from 'fs'
import { join } from 'path'
import type { WorkspaceHealthResult } from '../../shared/workspace-health'

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100 MB
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  '.DS_Store'
])

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function getLargeFiles(root: string): WorkspaceHealthResult['largeFiles'] {
  const results: WorkspaceHealthResult['largeFiles'] = []
  try {
    const entries = readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
      if (entry.isFile()) {
        const fullPath = join(root, entry.name)
        try {
          const stat = statSync(fullPath)
          if (stat.size >= LARGE_FILE_THRESHOLD) {
            results.push({ name: entry.name, sizeBytes: stat.size })
          }
        } catch {
          // skip inaccessible files
        }
      }
    }
  } catch {
    // skip inaccessible directories
  }
  return results
}

function getDiskSpace(root: string): { free: number; total: number; percent: number } {
  try {
    // Walk up until we find an existing path for statfs
    let target = root
    while (target && !isDir(target)) {
      const parent = join(target, '..')
      if (parent === target) break
      target = parent
    }
    const statfs = (require('fs') as typeof import('fs')).statfsSync
    const stats = statfs(target, { bigint: false })
    const total = (stats.blocks as number) * (stats.bsize as number)
    const free = (stats.bavail as number) * (stats.bsize as number)
    const percent = total > 0 ? Math.round((free / total) * 100) : 0
    return { free, total, percent }
  } catch {
    return { free: 0, total: 0, percent: 0 }
  }
}

export function getWorkspaceHealth(workspaceRoot: string): WorkspaceHealthResult {
  const largeFiles = getLargeFiles(workspaceRoot)
  const disk = getDiskSpace(workspaceRoot)
  return {
    largeFiles,
    diskFreeBytes: disk.free,
    diskTotalBytes: disk.total,
    diskFreePercent: disk.percent
  }
}
