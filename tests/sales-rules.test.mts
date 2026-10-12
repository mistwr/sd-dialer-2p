import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validNif, contractEnd, renewalState, canAssignSeller } from '../lib/utils/sales-rules.ts'
test('NIF rejects wrong checksum and accepts formatted valid NIF', () => {
  assert.equal(validNif('123456789'), true)
  assert.equal(validNif('123456788'), false)
  assert.equal(validNif('123 456 789'), true)
  assert.equal(validNif('000000000'), false)
})
test('contract dates clamp to month end and distinguish due and expired', () => {
  assert.equal(contractEnd('2024-02-29', 24), '2026-02-28')
  assert.equal(contractEnd('2026-01-31', 1), '2026-02-28')
  assert.equal(renewalState('2026-12-12', '2026-10-12'), 'a_terminar')
  assert.equal(renewalState('2026-10-11', '2026-10-12'), 'expirada')
  assert.equal(renewalState('2027-01-12', '2026-10-12'), 'ativa')
})
test('seller assignment is company scoped and restricted admins cannot assign outside team', () => {
  const actor = { id: 'a', company_id: 'one', role: 'admin', restricted_admin: false }
  assert.equal(canAssignSeller(actor, {id:'b',company_id:'two', supervisor_id:'a',created_by:'a'}), false)
  assert.equal(canAssignSeller(actor, {id:'b',company_id:'one'}), true)
  assert.equal(canAssignSeller({...actor,restricted_admin:true}, {id:'b',company_id:'one'}), false)
  assert.equal(canAssignSeller({...actor,role:'parceiro'}, {id:'b',company_id:'one'}), false)
})

test('removing retention preserves the sale while removing a sale archives it', async () => {
  const rules = await import('../lib/utils/sales-rules.ts')
  assert.deepEqual(rules.saleRemovalUpdate('fidelizacao'), {fidelizacao_inicio:null,fidelizacao_meses:null,fidelizacao_fim:null})
  const removed = rules.saleRemovalUpdate('venda')
  assert.equal(typeof removed.deleted_at, 'string')
  assert.throws(() => rules.saleRemovalUpdate('empresa'))
})
