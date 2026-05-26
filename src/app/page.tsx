import { redirect } from 'next/navigation';

export default function Home() {
  // Will redirect to landing — auth check handled client-side there
  redirect('/landing');
}
