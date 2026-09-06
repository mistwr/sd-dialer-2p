import { NextRequest, NextResponse } from 'next/server'

function xmlEscape(value: string) {
  return value.replace(/[<>&'\"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]!))
}

export async function POST(request: NextRequest) {
  const host = process.env.ASTERISK_PUBLIC_HOST || process.env.REBORN_ASTERISK_SIP_HOST
  const user = process.env.REBORN_ASTERISK_SIP_USER || 'reborn'
  if (!host) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-PT">Serviço temporariamente indisponível.</Say><Hangup/></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    })
  }

  const leadId = request.nextUrl.searchParams.get('lead_id') || ''
  const sipUri = `sip:${user}@${host}${leadId ? `?x-reborn-lead=${encodeURIComponent(leadId)}` : ''}`
  const username = process.env.REBORN_ASTERISK_SIP_USERNAME
  const password = process.env.REBORN_ASTERISK_SIP_PASSWORD
  const authAttrs = username && password
    ? ` username="${xmlEscape(username)}" password="${xmlEscape(password)}"`
    : ''

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Dial answerOnBridge="true" timeout="25">\n    <Sip${authAttrs}>${xmlEscape(sipUri)}</Sip>\n  </Dial>\n</Response>`
  return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export const GET = POST
