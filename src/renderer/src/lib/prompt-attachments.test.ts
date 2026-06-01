import { describe, expect, it } from 'vitest'
import type { AttachmentItem } from '../agent/types'
import { buildPromptWithAttachments } from './prompt-attachments'

function image(name: string, dataUrl?: string): AttachmentItem {
  return {
    id: `att-${name}`,
    name,
    mimeType: 'image/png',
    dataUrl: dataUrl ?? `data:image/png;base64,${name}`,
    size: 1024
  }
}

function file(name: string, mimeType = 'application/pdf'): AttachmentItem {
  return {
    id: `att-${name}`,
    name,
    mimeType,
    dataUrl: '',
    size: 2048
  }
}

describe('buildPromptWithAttachments', () => {
  it('returns text unchanged when attachments is undefined', () => {
    expect(buildPromptWithAttachments('hello')).toBe('hello')
  })

  it('returns text unchanged when attachments is empty', () => {
    expect(buildPromptWithAttachments('hello', [])).toBe('hello')
  })

  it('prepends image markdown before the text', () => {
    const result = buildPromptWithAttachments('what is this?', [
      image('cat.png', 'data:image/png;base64,abc')
    ])
    expect(result).toBe('![cat.png](data:image/png;base64,abc)\n\nwhat is this?')
  })

  it('prepends multiple images on separate lines', () => {
    const result = buildPromptWithAttachments('compare these', [
      image('a.png', 'data:image/png;base64,aaa'),
      image('b.png', 'data:image/png;base64,bbb')
    ])
    expect(result).toBe(
      '![a.png](data:image/png;base64,aaa)\n![b.png](data:image/png;base64,bbb)\n\ncompare these'
    )
  })

  it('prepends file references for non-image attachments', () => {
    const result = buildPromptWithAttachments('explain this', [
      file('report.pdf')
    ])
    expect(result).toBe('[Attached file: report.pdf]\n\nexplain this')
  })

  it('handles multiple non-image files', () => {
    const result = buildPromptWithAttachments('check these', [
      file('data.csv', 'text/csv'),
      file('config.toml', 'application/toml')
    ])
    expect(result).toBe(
      '[Attached file: data.csv]\n[Attached file: config.toml]\n\ncheck these'
    )
  })

  it('combines images and non-image files correctly', () => {
    const result = buildPromptWithAttachments('review', [
      image('screenshot.png', 'data:image/png;base64,xyz'),
      file('notes.txt', 'text/plain')
    ])
    expect(result).toBe(
      '![screenshot.png](data:image/png;base64,xyz)\n[Attached file: notes.txt]\n\nreview'
    )
  })

  it('handles text with leading/trailing whitespace', () => {
    const result = buildPromptWithAttachments('  hello  ', [
      image('img.png', 'data:image/png;base64,d')
    ])
    expect(result).toBe('![img.png](data:image/png;base64,d)\n\n  hello  ')
  })

  it('works with empty text', () => {
    const result = buildPromptWithAttachments('', [
      image('img.png', 'data:image/png;base64,d')
    ])
    expect(result).toBe('![img.png](data:image/png;base64,d)\n\n')
  })
})
