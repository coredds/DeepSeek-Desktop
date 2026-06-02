import { describe, expect, it } from 'vitest'
import type { AttachmentItem } from '../agent/types'
import {
  buildPromptWithAttachments,
  type ImageDescription
} from './prompt-attachments'

function image(name: string, dataUrl?: string): AttachmentItem {
  return {
    id: `img-${name}`,
    name,
    mimeType: 'image/png',
    dataUrl: dataUrl ?? `data:image/png;base64,${name}`,
    size: 1000
  }
}

function file(name: string): AttachmentItem {
  return {
    id: `file-${name}`,
    name,
    mimeType: 'text/plain',
    dataUrl: '',
    size: 500
  }
}

describe('buildPromptWithAttachments', () => {
  it('returns text unchanged when attachments is undefined', () => {
    expect(buildPromptWithAttachments('hello', undefined)).toBe('hello')
  })

  it('returns text unchanged when attachments is empty', () => {
    expect(buildPromptWithAttachments('hello', [])).toBe('hello')
  })

  it('prepends markdown image for a single image without descriptions', () => {
    const result = buildPromptWithAttachments('hello', [image('photo.png')])
    expect(result).toBe('![photo.png](data:image/png;base64,photo.png)\n\nhello')
  })

  it('prepends markdown images for multiple images without descriptions', () => {
    const result = buildPromptWithAttachments('hello', [
      image('a.png'),
      image('b.png')
    ])
    expect(result).toContain('![a.png]')
    expect(result).toContain('![b.png]')
  })

  it('lists non-image files without descriptions', () => {
    const result = buildPromptWithAttachments('hello', [file('doc.txt')])
    expect(result).toBe('[Attached file: doc.txt]\n\nhello')
  })

  it('mixes images and files without descriptions', () => {
    const result = buildPromptWithAttachments('hello', [
      image('photo.png'),
      file('doc.txt')
    ])
    expect(result).toContain('![photo.png]')
    expect(result).toContain('[Attached file: doc.txt]')
  })

  it('uses text descriptions when provided', () => {
    const descs: ImageDescription[] = [
      { name: 'photo.png', text: 'A golden retriever.' }
    ]
    const result = buildPromptWithAttachments('what is this?', [image('photo.png')], descs)
    expect(result).toBe('[Image: photo.png]\nA golden retriever.\n\nwhat is this?')
  })

  it('strips image data when empty descriptions array is provided', () => {
    const result = buildPromptWithAttachments('hello', [image('photo.png')], [])
    expect(result).not.toContain('![')
    expect(result).not.toContain('base64')
    expect(result).toBe('hello')
  })

  it('handles text with whitespace', () => {
    const result = buildPromptWithAttachments('  hello world  ', [image('img.png')])
    expect(result).toBe('![img.png](data:image/png;base64,img.png)\n\n  hello world  ')
  })

  it('returns only text when attachments array is empty with descriptions', () => {
    expect(buildPromptWithAttachments('hello', [], [])).toBe('hello')
  })
})
