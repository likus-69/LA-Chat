import { redirect } from 'next/navigation';

export default function HomePage() {
  // Unauthenticated users go to /login; they'll be redirected to /chat after
  // they sign in. A proper middleware will handle auth-aware routing in a
  // later phase — for now /login redirects to /chat on success.
  redirect('/login');
}
