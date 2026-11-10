import { redirect } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  // The home page is just a redirect to /login for unauthenticated users.
  // For an authenticated user, /dashboard is the landing page.
  // A proper middleware will handle this in Phase 2.
  redirect('/login');
}
