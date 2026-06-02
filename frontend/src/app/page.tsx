import { redirect } from 'next/navigation'

// The root URL redirects straight to the dashboard.
// The middleware will send unauthenticated users to /login automatically.
export default function RootPage() {
  redirect('/dashboard')
}
