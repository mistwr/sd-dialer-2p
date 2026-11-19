// Manutenção das chamadas de IA, das campanhas automáticas e do Marcador.
// Ativa por defeito; exceção só para os utilizadores em MANUTENCAO_EXCECOES (ids separados por vírgula).
// Para desligar a manutenção para todos: MANUTENCAO_CHAMADAS=off na Netlify.
const MIGUEL = '8c43ee2a-9c99-4493-a215-abcb0849b8bf'

export const MANUTENCAO_ATIVA = process.env.MANUTENCAO_CHAMADAS !== 'off' && process.env.AUTO_DIALER_MANUTENCAO !== 'off'
export const MSG_MANUTENCAO = 'As chamadas (IA, campanhas automáticas e Marcador) estão em manutenção. Voltam a estar disponíveis em breve.'

const excecoes = new Set((process.env.MANUTENCAO_EXCECOES || MIGUEL).split(',').map(s => s.trim()).filter(Boolean))

export function emManutencaoPara(userId?: string | null): boolean {
  return MANUTENCAO_ATIVA && !(userId && excecoes.has(userId))
}

export function ehExcecao(userId?: string | null): boolean {
  return Boolean(userId && excecoes.has(userId))
}
