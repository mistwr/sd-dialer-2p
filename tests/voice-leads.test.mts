import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canViewVoiceSeller, voiceLeadSearch, VOICE_BLOCKED_STATUSES } from '../lib/utils/voice-leads.ts'

const actor = { id: 'supervisor', company_id: 'one', role: 'supervisor', status: 'active', full_name: 'Supervisor' }
const seller = { id: 'seller', company_id: 'one', role: 'parceiro', status: 'active', full_name: 'Vendedor', supervisor_id: actor.id }
test('supervisors see their own leads and assigned team, never other companies or another supervisors team', () => {
  assert.equal(canViewVoiceSeller(actor, actor), true)
  assert.equal(canViewVoiceSeller(actor, seller), true)
  assert.equal(canViewVoiceSeller(actor, { ...seller, company_id: 'two' }), false)
  assert.equal(canViewVoiceSeller(actor, { ...seller, supervisor_id: 'other' }), false)
  assert.equal(canViewVoiceSeller(actor, { ...seller, supervisor_id: 'other', created_by: actor.id }), false)
  assert.equal(canViewVoiceSeller(actor, { ...seller, supervisor_id: null, created_by: actor.id }), true)
  assert.equal(canViewVoiceSeller(actor, { ...seller, status: 'suspended' }), false)
})
test('sellers only see themselves; restricted admins stay inside team', () => {
  assert.equal(canViewVoiceSeller(seller, seller), true)
  assert.equal(canViewVoiceSeller(seller, actor), false)
  assert.equal(canViewVoiceSeller({ ...actor, role: 'admin' }, { ...seller, supervisor_id: 'other' }), true)
  assert.equal(canViewVoiceSeller({ ...actor, role: 'admin', restricted_admin: true }, { ...seller, supervisor_id: 'other' }), false)
  assert.equal(canViewVoiceSeller({ ...actor, company_id: null }, seller), false)
  assert.equal(canViewVoiceSeller({ ...actor, status: 'inactive' }, seller), false)
})
test('search keeps Portuguese names and phone prefixes while removing PostgREST syntax', () => {
  assert.equal(voiceLeadSearch('João +351 912'), 'João +351 912')
  assert.equal(voiceLeadSearch('a%,_\\(){}:;'), 'a')
  assert.equal(voiceLeadSearch('x'.repeat(100)).length, 80)
  assert.ok(VOICE_BLOCKED_STATUSES.includes('nao_interessado'))
  assert.ok(VOICE_BLOCKED_STATUSES.includes('vendido'))
})
