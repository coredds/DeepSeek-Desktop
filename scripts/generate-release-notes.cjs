#!/usr/bin/env node
/**
 * Build GitHub release notes from conventional commits since the previous tag.
 *
 * Usage:
 *   node scripts/generate-release-notes.cjs [sinceTag]
 *   node scripts/generate-release-notes.cjs v0.1.0.8
 *
 * If sinceTag is omitted, uses the newest v* tag on origin (excluding HEAD).
 */

const { execFileSync } = require('node:child_process')

const CONVENTIONAL =
  /^(feat|fix|perf|refactor|docs|chore|test|build|ci)(\([\w./-]+\))?!?:\s*(.+)$/i

const GROUPS = [
  { key: 'feat', heading: '### ✨ Features' },
  { key: 'fix', heading: '### 🐛 Fixes' },
  { key: 'perf', heading: '### ⚡ Performance' },
  { key: 'refactor', heading: '### ♻️ Refactoring' },
  { key: 'docs', heading: '### 📝 Documentation' },
  { key: 'other', heading: '### 📦 Other' }
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: process.cwd() }).trim()
}

function resolveSinceTag(arg) {
  const input = (arg || '').trim()
  if (input) {
    return input.startsWith('v') ? input : `v${input}`
  }

  const lines = git([
    'tag',
    '--list',
    'v*',
    '--sort=-version:refname'
  ])
    .split('\n')
    .filter(Boolean)

  if (lines.length === 0) return null
  return lines[0]
}

function formatCommitLine(hash, subject) {
  const short = hash.slice(0, 7)
  const match = subject.match(CONVENTIONAL)
  if (!match) {
    return { type: 'other', line: `- ${subject} (\`${short}\`)` }
  }

  const type = match[1].toLowerCase()
  const scope = match[2] ? match[2].slice(1, -1) : ''
  const description = match[3].trim()
  const scopePrefix = scope ? `**${scope}**: ` : ''
  const bucket = ['feat', 'fix', 'perf', 'refactor', 'docs'].includes(type)
    ? type
    : ['chore', 'test', 'build', 'ci'].includes(type)
      ? 'other'
      : 'other'

  return {
    type: bucket,
    line: `- ${scopePrefix}${description} (\`${short}\`)`
  }
}

function main() {
  const sinceTag = resolveSinceTag(process.argv[2])
  const range = sinceTag ? `${sinceTag}..HEAD` : 'HEAD'
  const count = git(['rev-list', '--count', range])
  if (count === '0') {
    console.log('## Changelog\n\n(No new commits since the previous version)\n')
    return
  }

  const log = git([
    'log',
    range,
    '--pretty=format:%H%x09%s',
    '--no-merges',
    '--reverse'
  ])

  const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]))

  for (const row of log.split('\n').filter(Boolean)) {
    const tab = row.indexOf('\t')
    if (tab === -1) continue
    const hash = row.slice(0, tab)
    const subject = row.slice(tab + 1)
    const { type, line } = formatCommitLine(hash, subject)
    buckets[type].push(line)
  }

  const out = ['## Changelog', '']
  if (sinceTag) {
    out.push(`Changes since [\`${sinceTag}\`](https://github.com/coredds/DeepSeek-Desktop/compare/${sinceTag}...HEAD):`, '')
  }

  let wroteSection = false
  for (const group of GROUPS) {
    const items = buckets[group.key]
    if (!items.length) continue
    wroteSection = true
    out.push(group.heading, '', ...items, '')
  }

  if (!wroteSection) {
    out.push('(No conventional commits found, see full commit list below)', '')
    for (const row of log.split('\n').filter(Boolean)) {
      const subject = row.slice(row.indexOf('\t') + 1)
      out.push(`- ${subject}`)
    }
    out.push('')
  }

  process.stdout.write(`${out.join('\n').trimEnd()}\n`)
}

main()
