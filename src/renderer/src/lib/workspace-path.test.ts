import { describe, expect, it } from 'vitest'
import {
  isPureChatWorkspace,
  isClawWorkspacePath,
  isInternalTemporaryWorkspace,
  normalizeWorkspaceRoot,
  PURE_CHAT_WORKSPACE
} from './workspace-path'

describe('workspace-path', () => {
  describe('PURE_CHAT_WORKSPACE', () => {
    it('is a non-empty string sentinel', () => {
      expect(PURE_CHAT_WORKSPACE).toBeTruthy()
      expect(typeof PURE_CHAT_WORKSPACE).toBe('string')
    })
  })

  describe('isPureChatWorkspace', () => {
    it('returns true for the sentinel', () => {
      expect(isPureChatWorkspace(PURE_CHAT_WORKSPACE)).toBe(true)
    })

    it('returns true for the sentinel with surrounding whitespace', () => {
      expect(isPureChatWorkspace(`  ${PURE_CHAT_WORKSPACE}  `)).toBe(true)
    })

    it('returns false for a real filesystem path', () => {
      expect(isPureChatWorkspace('/Users/zxy/workspace')).toBe(false)
      expect(isPureChatWorkspace('C:\\Users\\zxy\\projects')).toBe(false)
    })

    it('returns false for empty / null / undefined', () => {
      expect(isPureChatWorkspace('')).toBe(false)
      expect(isPureChatWorkspace(undefined)).toBe(false)
    })

    it('returns false for claw workspace paths', () => {
      expect(isPureChatWorkspace('/Users/zxy/.deepseekdesktop/claw/channel-1')).toBe(false)
    })

    it('returns false for internal temporary paths', () => {
      expect(isPureChatWorkspace('/tmp')).toBe(false)
    })
  })

  describe('normalizeWorkspaceRoot with pure-chat sentinel', () => {
    it('passes through the pure-chat sentinel unchanged', () => {
      expect(normalizeWorkspaceRoot(PURE_CHAT_WORKSPACE)).toBe(PURE_CHAT_WORKSPACE)
    })

    it('trims whitespace around the pure-chat sentinel', () => {
      expect(normalizeWorkspaceRoot(` ${PURE_CHAT_WORKSPACE} `)).toBe(PURE_CHAT_WORKSPACE)
    })
  })

  describe('isClawWorkspacePath', () => {
    it('identifies claw workspace paths', () => {
      expect(isClawWorkspacePath('/Users/zxy/.deepseekdesktop/claw/channel-1')).toBe(true)
      expect(isClawWorkspacePath('C:\\Users\\zxy\\.deepseekdesktop\\claw\\channel-1')).toBe(true)
    })

    it('rejects non-claw paths', () => {
      expect(isClawWorkspacePath(PURE_CHAT_WORKSPACE)).toBe(false)
      expect(isClawWorkspacePath('/Users/zxy/workspace')).toBe(false)
    })
  })

  describe('isInternalTemporaryWorkspace', () => {
    it('rejects the pure-chat sentinel', () => {
      expect(isInternalTemporaryWorkspace(PURE_CHAT_WORKSPACE)).toBe(false)
    })
  })
})
