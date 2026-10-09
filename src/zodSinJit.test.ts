import { describe, expect, it } from 'vitest'
import { config } from 'zod/v4/core'
import './zodSinJit'

describe('zod sin JIT (revisión final, M9)', () => {
  it('al arrancar, zod queda sin JIT: no prueba Function("") y la CSP no reporta script-src', () => {
    expect(config().jitless).toBe(true)
  })
})
