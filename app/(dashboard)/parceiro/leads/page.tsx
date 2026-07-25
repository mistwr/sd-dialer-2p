import { redirect } from 'next/navigation'

// The parceiro leads list lives at /parceiro (the main dashboard)
export default function ParceiroLeadsListPage() {
  redirect('/parceiro')
}
