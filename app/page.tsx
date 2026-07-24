'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Page() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        // Obter perfil para redirecionar baseado no role
        const { data: profile } = await supabase
          .from('usuarios')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile?.role === 'admin') {
          router.push('/dashboard/admin')
        } else if (profile?.role === 'supervisor') {
          router.push('/dashboard/supervisor')
        } else {
          router.push('/dashboard/comercial/leads')
        }
      } else {
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-blue-600 rounded-lg flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </div>
        <p className="text-gray-600">Carregando SD Dialer...</p>
      </div>
    </div>
  )
}
