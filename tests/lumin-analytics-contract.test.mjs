// Contract checks for the LUMIN website analytics endpoint.
// Run with: node --test tests/lumin-analytics-contract.test.mjs
// These are static regression checks; they do NOT prove the deployed API
// points at the intended Supabase project or that events are persisted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const route = readFileSync(resolve(root, 'app/api/lumin/event/route.ts'), 'utf8')

const eventSet = route.match(/const EVENT_TYPES = new Set\(\[([\s\S]*?)\]\)/)
assert.ok(eventSet, 'Could not find EVENT_TYPES in the API route')
const allowedEvents = new Set([...eventSet[1].matchAll(/'([^']+)'/g)].map((m) => m[1]))

test('accepts the events emitted by the LUMIN website and simulation form', () => {
  const expected = [
    'page_view', 'robot_click', 'pro_click', 'checkout_click',
    'whatsapp_click', 'simulation_click', 'simulation_result',
    'analysis_click', 'product_click', 'simulation_form_view', 'lead_submit',
  ]
  for (const event of expected) {
    assert.ok(allowedEvents.has(event), `Missing website event: ${event}`)
  }
})

test('uses the intended Indigo analytics table in the candidate fix', () => {
  assert.match(route, /\.from\('lumin_events'\)\.insert\(payload\)/)
  assert.doesNotMatch(route, /\.from\('lumin_analytics_events'\)/)
})

test('preserves attribution fields needed to connect events to leads', () => {
  for (const field of [
    'event_type', 'page_path', 'utm_source', 'utm_medium',
    'utm_campaign', 'utm_content', 'referrer_domain',
    'session_id', 'event_data',
  ]) {
    assert.match(route, new RegExp('\\b' + field + '\\s*:'))
  }
})

test('keeps the website origin allowlist', () => {
  assert.match(route, /https:\/\/luminai\.pt/)
  assert.match(route, /https:\/\/www\.luminai\.pt/)
})

// Before any merge/deploy, separately verify the production service's
// NEXT_PUBLIC_SUPABASE_URL project, table columns, RLS/service-role access,
// HTTP POST response, persisted row, and checkout-to-payment reconciliation.
