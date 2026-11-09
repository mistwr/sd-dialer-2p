// Equipas criadas por um superadmin ficam escondidas dos admins/supervisores da empresa
// (mesma regra da função get_hidden_user_ids() na base de dados).
// Escondidos: utilizadores criados por um superadmin (exceto o próprio) e os parceiros que eles supervisionam.

const HIDE_SUPERADMIN_TEAMS = false as boolean

type Actor = { id: string; company_id: string | null; is_super_admin?: boolean | null; role?: string | null }

export async function getHiddenUserIds(admin: any, actor: Actor): Promise<Set<string>> {
  const hidden = new Set<string>()
  // Regra desativada (o admin vê a empresa toda); a separação entre empresas é feita por company_id.
  if (HIDE_SUPERADMIN_TEAMS === false) return hidden
  if (!actor?.company_id || actor.is_super_admin || actor.role === 'super_admin') return hidden

  const [{ data: superAdmins }, { data: users }] = await Promise.all([
    admin.from('usuarios').select('id').eq('is_super_admin', true),
    admin.from('usuarios').select('id,created_by,supervisor_id,is_super_admin').eq('company_id', actor.company_id),
  ])
  const supers = new Set((superAdmins || []).map((u: any) => String(u.id)))
  if (!supers.size) return hidden

  for (const u of users || []) {
    if (u.is_super_admin || String(u.id) === actor.id) continue
    if (u.created_by && supers.has(String(u.created_by))) hidden.add(String(u.id))
  }
  for (const u of users || []) {
    if (String(u.id) === actor.id || u.is_super_admin) continue
    if (u.supervisor_id && hidden.has(String(u.supervisor_id))) hidden.add(String(u.id))
  }
  return hidden
}
