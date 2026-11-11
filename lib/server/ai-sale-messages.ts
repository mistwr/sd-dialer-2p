// Mensagens enviadas ao cliente depois de uma venda fechada pelo robot de IA:
// email de boas-vindas (HTML), SMS e WhatsApp. Funções puras, sem acesso à base de dados.

export type SaleMessageInput = {
  nome: string
  operadora: string
  pacote: string
  precoMensal: number | null
  link: string
  consultor?: string | null
  marca?: string
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[char] || char))
}

export function primeiroNome(value: string): string {
  const first = String(value || '').trim().split(/\s+/)[0] || ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
}

export function formatEuro(value: number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : ''
}

export function buildSaleSms(input: SaleMessageInput): string {
  const marca = input.marca || 'Compara+'
  const nome = primeiroNome(input.nome)
  return (
    marca + ': obrigado pela sua adesão' + (nome ? ', ' + nome : '') + '! Para concluir o pedido ' + input.operadora +
    ', confirme os dados e assine aqui: ' + input.link + ' (link válido 7 dias).'
  )
}

export function buildSaleEmail(input: SaleMessageInput): { subject: string; html: string; text: string } {
  const marca = input.marca || 'Compara+'
  const nome = primeiroNome(input.nome)
  const preco = formatEuro(input.precoMensal)
  const saudacao = nome ? 'Olá, ' + nome + '!' : 'Olá!'
  const subject = 'Bem-vindo(a)' + (nome ? ', ' + nome : '') + '! Falta só um passo para concluir o seu pedido'
  const consultor = input.consultor ? escapeHtml(input.consultor) : ''

  const passos = [
    ['1', 'Abra o link', 'Toque no botão abaixo. Não precisa de criar conta nem de instalar nada.'],
    ['2', 'Confirme os seus dados', 'Veja o resumo do pedido e confirme que está tudo certo.'],
    ['3', 'Assine com o dedo e anexe os documentos', 'Documento de identificação, comprovativo de morada e uma fatura atual. Demora cerca de 2 minutos.'],
  ]
    .map(
      ([n, titulo, texto]) =>
        '<tr><td style="padding:0 14px 16px 0;vertical-align:top;width:34px">' +
        '<div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:#E8F7F1;color:#0A8F63;font-weight:700;text-align:center;font-size:14px">' + n + '</div></td>' +
        '<td style="padding:0 0 16px 0;vertical-align:top"><div style="font-size:15px;font-weight:700;color:#0F172A">' + escapeHtml(titulo) + '</div>' +
        '<div style="font-size:14px;line-height:20px;color:#475569;margin-top:2px">' + escapeHtml(texto) + '</div></td></tr>',
    )
    .join('')

  const html =
    '<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Obrigado pela sua adesão. Confirme e assine o pedido em 2 minutos.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9"><tr><td align="center" style="padding:28px 14px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +
    '<tr><td style="padding:0 6px 16px 6px;font-size:20px;font-weight:800;color:#0B1B3A;letter-spacing:-0.3px">' + escapeHtml(marca) + '</td></tr>' +
    '<tr><td style="background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08)">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    '<tr><td style="background:#0B1B3A;padding:30px 28px">' +
    '<div style="font-size:13px;font-weight:700;color:#5EEAB4;text-transform:uppercase;letter-spacing:1px">Pedido recebido</div>' +
    '<div style="font-size:26px;line-height:32px;font-weight:800;color:#FFFFFF;margin-top:8px">' + escapeHtml(saudacao) + ' Obrigado pela sua adesão.</div>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 28px 6px 28px">' +
    '<p style="margin:0 0 16px 0;font-size:15px;line-height:23px;color:#334155">Foi um gosto falar consigo. Ficou combinado o seguinte serviço e já deixámos o seu pedido preparado. Falta só confirmar e assinar para o podermos submeter.</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px">' +
    '<tr><td style="padding:16px 18px">' +
    '<div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.8px">O seu pedido</div>' +
    '<div style="font-size:17px;line-height:24px;font-weight:800;color:#0F172A;margin-top:6px">' + escapeHtml(input.operadora) + ' · ' + escapeHtml(input.pacote) + '</div>' +
    (preco ? '<div style="font-size:15px;color:#0A8F63;font-weight:700;margin-top:6px">' + escapeHtml(preco) + ' / mês <span style="color:#64748B;font-weight:400">(IVA incluído)</span></div>' : '') +
    '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td align="center" style="padding:22px 28px 8px 28px">' +
    '<a href="' + escapeHtml(input.link) + '" style="display:inline-block;background:#00B97D;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;padding:15px 30px;border-radius:12px">Confirmar e assinar o pedido</a>' +
    '<div style="font-size:12px;color:#94A3B8;margin-top:10px">O link é pessoal e válido durante 7 dias.</div>' +
    '</td></tr>' +
    '<tr><td style="padding:22px 28px 6px 28px"><div style="font-size:16px;font-weight:800;color:#0F172A;margin-bottom:14px">Como funciona</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + passos + '</table></td></tr>' +
    '<tr><td style="padding:4px 28px 26px 28px">' +
    '<p style="margin:0;font-size:13px;line-height:20px;color:#64748B">O valor e as condições (incluindo o período de fidelização) ficam confirmados no processo de adesão do operador. Se algo não corresponder ao que falámos, responda a este email antes de assinar.</p>' +
    (consultor ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:21px;color:#334155">O seu consultor: <strong>' + consultor + '</strong>. Estamos consigo em todo o processo.</p>' : '') +
    '</td></tr></table></td></tr>' +
    '<tr><td style="padding:18px 8px 0 8px;font-size:12px;line-height:18px;color:#94A3B8;text-align:center">Recebeu este email porque falámos consigo por telefone sobre o seu serviço de telecomunicações. Se o botão não funcionar, copie este endereço para o navegador:<br>' +
    '<span style="word-break:break-all;color:#64748B">' + escapeHtml(input.link) + '</span></td></tr>' +
    '</table></td></tr></table></body></html>'

  const text =
    saudacao + ' Obrigado pela sua adesão.\n\n' +
    'O seu pedido: ' + input.operadora + ' - ' + input.pacote + (preco ? ' (' + preco + '/mês, IVA incluído)' : '') + '\n\n' +
    'Falta só confirmar e assinar (cerca de 2 minutos):\n' + input.link + '\n\n' +
    '1. Abra o link\n2. Confirme os seus dados\n3. Assine com o dedo e anexe identificação, comprovativo de morada e uma fatura atual\n\n' +
    'O link é pessoal e válido durante 7 dias. O valor e as condições ficam confirmados no processo de adesão do operador.' +
    (input.consultor ? '\n\nO seu consultor: ' + input.consultor : '')

  return { subject, html, text }
}

const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i

export function normalizeSpokenEmail(value: unknown): string | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+arroba\s+/g, '@')
    .replace(/\s+ponto\s+/g, '.')
    .replace(/\s+/g, '')
  return EMAIL_RE.test(raw) ? raw : null
}
