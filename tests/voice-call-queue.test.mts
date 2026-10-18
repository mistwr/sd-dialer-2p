import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VoiceCallQueue } from '../lib/utils/voice-call-queue.ts'
const leads = [{id:'a',telefone:'912345678'}, {id:'b',telefone:'923456789'}]
test('calls sequentially and ignores duplicate terminal events', () => {
 const q = new VoiceCallQueue(leads)
 assert.equal(q.take()?.id,'a'); assert.equal(q.take(),null)
 assert.equal(q.complete('wrong'),false); assert.equal(q.complete('a'),true)
 assert.equal(q.complete('a'),false); assert.equal(q.take()?.id,'b')
 q.complete('b'); assert.equal(q.take(),null); assert.equal(q.completed,2)
})
test('pause waits for active call, resume preserves remaining leads, stop discards them', () => {
 const q = new VoiceCallQueue(leads); q.take(); q.pause(); q.complete('a')
 assert.equal(q.take(),null); q.resume(); assert.equal(q.take()?.id,'b')
 q.stop(); q.complete('b'); q.resume(); assert.equal(q.take(),null)
})
test('deduplicates lead IDs and equivalent Portuguese numbers', () => {
 const q = new VoiceCallQueue([...leads,leads[0],{id:'c',telefone:'+351 912 345 678'}])
 assert.equal(q.total,2)
})
