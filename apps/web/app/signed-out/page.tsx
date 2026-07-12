import { redirect } from 'next/navigation';

export default function SignedOutPage() {
  redirect('/sign-in');
}
