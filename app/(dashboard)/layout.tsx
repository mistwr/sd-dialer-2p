import { DashboardLayout } from '@/components/layout/DashboardLayout'

// Prevent static generation for protected routes
export const dynamic = 'force-dynamic'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
