// The middleware in lib/supabase/proxy.ts redirects "/" before this page
// is ever rendered, so this component never executes.
export default function Page() {
  return null
}
