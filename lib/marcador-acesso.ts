// Quem pode ver e usar o Marcador automático. Por agora só o Miguel Ferreira.
// Para dar acesso a mais pessoas: NEXT_PUBLIC_MARCADOR_USER_IDS no Netlify (ids separados por vírgulas).
export const MARCADOR_USER_IDS = (process.env.NEXT_PUBLIC_MARCADOR_USER_IDS || '8c43ee2a-9c99-4493-a215-abcb0849b8bf')
  .split(',').map((s) => s.trim()).filter(Boolean)

export const podeMarcador = (userId?: string | null) => !!userId && MARCADOR_USER_IDS.includes(userId)
