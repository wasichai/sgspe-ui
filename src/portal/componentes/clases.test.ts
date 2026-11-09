import { cn } from '@wasichai/ui'
import { describe, expect, it } from 'vitest'
import { unir } from './clases'

describe('unir', () => {
  it('conserva el tamaño de texto junto al color, que cn quitaría', () => {
    expect(cn('text-sg-caption', 'text-sg-danger')).not.toContain('text-sg-caption')
    expect(unir('text-sg-caption', false, 'text-sg-danger', undefined, null)).toBe('text-sg-caption text-sg-danger')
  })
})
