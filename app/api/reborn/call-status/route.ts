import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const event = {
    callSid: String(form.get('CallSid') || ''),
    parentCallSid: String(form.get('ParentCallSid') || ''),
    status: String(form.get('CallStatus') || ''),
    direction: String(form.get('Direction') || ''),
    from: String(form.get('From') || ''),
    to: String(form.get('To') || ''),
    duration: String(form.get('CallDuration') || ''),
    timestamp: new Date().toISOString(),
  }

  console.info('[reborn-twilio-status]', JSON.stringify(event))
  return new NextResponse(null, { status: 204 })
}
