export function validNif(value: string) {
  const nif = value.replace(/\s/g, '')
  if (!/^[1235689]\d{8}$/.test(nif)) return false
  const sum = [...nif.slice(0, 8)].reduce((n, digit, i) => n + Number(digit) * (9 - i), 0)
  const digit = 11 - sum % 11
  return Number(nif[8]) === (digit >= 10 ? 0 : digit)
}
export function contractEnd(start: string, months: number) {
  const date = new Date(start + 'T12:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(months) || months < 1 || months > 60 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== start) throw new Error('Fidelização inválida.')
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return date.toISOString().slice(0, 10)
}
export function renewalState(end: string, today = new Date().toISOString().slice(0, 10)) {
  if (end < today) return 'expirada'
  const warning = new Date(end + 'T12:00:00Z')
  const day = warning.getUTCDate()
  warning.setUTCDate(1)
  warning.setUTCMonth(warning.getUTCMonth() - 2)
  const last = new Date(Date.UTC(warning.getUTCFullYear(),warning.getUTCMonth()+1,0)).getUTCDate()
  warning.setUTCDate(Math.min(day,last))
  return warning.toISOString().slice(0, 10) <= today ? 'a_terminar' : 'ativa'
}
type Actor = {id:string;company_id:string|null;role:string;restricted_admin?:boolean}
type Seller = {id:string;company_id:string|null;supervisor_id?:string|null;created_by?:string|null}
export function canAssignSeller(actor: Actor, seller: Seller) {
  if (!actor.company_id || actor.company_id !== seller.company_id) return false
  if (actor.id === seller.id) return true
  if (actor.role !== 'admin' && actor.role !== 'supervisor') return false
  return !actor.restricted_admin || seller.supervisor_id === actor.id || (!seller.supervisor_id && seller.created_by === actor.id)
}
