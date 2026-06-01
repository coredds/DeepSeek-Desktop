import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WriteInlineCompletionRequest } from '../../shared/write-inline-completion'
import {
  clearWriteRetrievalCache,
  retrieveWriteInlineCompletionContext,
  tokenizeWriteRetrievalText
} from './write-retrieval-service'

function createRequest(workspaceRoot: string): WriteInlineCompletionRequest {
  return {
    workspaceRoot,
    currentFilePath: join(workspaceRoot, 'draft.md'),
    prefix: '# Draft\n\nBM25 keyword',
    suffix: '',
    cursor: {
      line: 3,
      column: 9
    },
    context: {
      language: 'markdown',
      currentLinePrefix: 'BM25 keyword',
      currentLineSuffix: '',
      previousLine: '',
      previousNonEmptyLine: '# Draft',
      nextLine: '',
      indentation: '',
      signals: {
        list: false,
        quote: false,
        heading: false,
        table: false,
        atLineEnd: true,
        endsWithSentencePunctuation: false,
        previousLineEndsWithSentencePunctuation: false,
        prefersNewLineCompletion: false,
        paragraphBreakOpportunity: false
      }
    },
    policy: {
      name: 'precision-inline-v2',
      instruction: 'Return only inserted text.',
      acceptanceCriteria: ['Keep it short.'],
      rejectionCriteria: ['Do not ramble.']
    },
    preview: {
      local: 'BM25 keyword',
      documentTail: '# Draft BM25 keyword'
    },
    model: 'deepseek-v4-flash'
  }
}

afterEach(() => {
  clearWriteRetrievalCache()
})

describe('write retrieval service', () => {
  it('tokenizes latin terms and CJK keyword ngrams', () => {
    const tokens = tokenizeWriteRetrievalText('BM25 keyword retrieval RAG')

    expect(tokens).toContain('bm25')
    expect(tokens).toContain('rag')
    expect(tokens).toContain('keyword')
    expect(tokens).toContain('retrieval')
  })

  it('retrieves relevant cross-document snippets and excludes the active file', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ds-gui-write-rag-'))
    await mkdir(join(workspaceRoot, 'research'), { recursive: true })
    await writeFile(
      join(workspaceRoot, 'draft.md'),
      '# Draft\n\nBM25 keyword',
      'utf8'
    )
    await writeFile(
      join(workspaceRoot, 'research', 'rag.md'),
      [
        '# Retrieval approach',
        '',
        'BM25 keyword retrieval finds relevant snippets in the writing workspace.',
        'These snippets serve as RAG context to help completions stay consistent with terminology.'
      ].join('\n'),
      'utf8'
    )
    await writeFile(
      join(workspaceRoot, 'unrelated.md'),
      '# Shopping',
      'utf8'
    )

    const result = await retrieveWriteInlineCompletionContext(createRequest(workspaceRoot))

    expect(result?.source).toBe('bm25-keyword')
    expect(result?.snippets[0].path).toBe(`research${sep}rag.md`)
    expect(result?.snippets[0].text).toContain('BM25 keyword retrieval')
    expect(result?.snippets.some((snippet) => snippet.path === 'draft.md')).toBe(false)
  })

  it('ignores unsupported large data files while scanning the workspace', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ds-gui-write-rag-'))
    await writeFile(join(workspaceRoot, 'draft.md'), '# Draft\n\nembedding cache', 'utf8')
    await writeFile(
      join(workspaceRoot, 'notes.md'),
      '# Notes\n\nEmbedding cache notes help the inline completion stay consistent.',
      'utf8'
    )
    await writeFile(join(workspaceRoot, 'output.jsonl'), `${'x'.repeat(10_000)}\n`, 'utf8')

    const result = await retrieveWriteInlineCompletionContext({
      ...createRequest(workspaceRoot),
      prefix: '# Draft\n\nembedding cache',
      context: {
        ...createRequest(workspaceRoot).context,
        currentLinePrefix: 'embedding cache',
        previousNonEmptyLine: '# Draft'
      },
      preview: {
        local: 'embedding cache',
        documentTail: '# Draft embedding cache'
      }
    })

    expect(result?.snippets.some((snippet) => snippet.path === 'output.jsonl')).toBe(false)
    expect(result?.snippets.some((snippet) => snippet.path === 'notes.md')).toBe(true)
  })
})
