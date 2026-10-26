import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSharedCallerId } from '../lib/server/sd-dialer-shared-caller.ts'

const now = Date.parse('2026-10-26T12:00:00Z')
const authorized = {
  user_id: 'elisabete', company_id: 'company-a', use_system_caller_id: true,
  status: 'active', expires_at: '2026-11-25T12:00:00Z',
}
// The real database is external; this double applies the requested equality filters.
function database(row: Record<string, unknown> | null, error: unknown = null) {
  return { from(table: string) {
    assert.equal(table, 'voice_call_subscriptions')
    const filters: Record<string, unknown> = {}
    return {
      select() { return this },
      eq(key: string, value: unknown) { filters[key] = value; return this },
      async maybeSingle() {
        return { data: row && Object.entries(filters).every(([key, value]) => row[key] === value) ? row : null, error }
      },
    }
  } } as any
}

test('an explicitly authorized subscriber can use the existing system caller ID', async () => {
  assert.equal(await resolveSharedCallerId(database(authorized), 'elisabete', 'company-a', '+351912345678', now), '+351912345678')
})

for (const [label, row] of [
  ['missing grant', null],
  ['permission disabled', { ...authorized, use_system_caller_id: false }],
  ['another user', { ...authorized, user_id: 'someone-else' }],
  ['another company', { ...authorized, company_id: 'company-b' }],
  ['revoked subscription', { ...authorized, status: 'revoked' }],
  ['expired subscription', { ...authorized, expires_at: '2026-10-26T12:00:00Z' }],
  ['invalid expiry', { ...authorized, expires_at: 'invalid' }],
] as const) {
  test(`does not share the system caller ID: ${label}`, async () => {
    assert.equal(await resolveSharedCallerId(database(row), 'elisabete', 'company-a', '+351912345678', now), '')
  })
}

test('missing system configuration does not enable calls', async () => {
  assert.equal(await resolveSharedCallerId(database(authorized), 'elisabete', 'company-a', '', now), '')
})

test('a failed permission lookup fails closed', async () => {
  await assert.rejects(resolveSharedCallerId(database(null, { code: 'DB_ERROR' }), 'elisabete', 'company-a', '+351912345678', now))
})
