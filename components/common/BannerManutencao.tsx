import { createClient } from '@/lib/supabase/server'
import { emManutencaoPara, MSG_MANUTENCAO } from '@/lib/server/manutencao'

export async function BannerManutencao() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!emManutencaoPara(user?.id)) return null
  return (
    <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontWeight: 600 }}>
      🛠️ {MSG_MANUTENCAO}
    </div>
  )
}
