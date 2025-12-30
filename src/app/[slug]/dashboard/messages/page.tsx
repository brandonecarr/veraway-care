import { createClient } from '../../../../../supabase/server';
import { redirect } from 'next/navigation';
import { MessageCenter } from '@/components/messages/message-center';
import DashboardNavbar from '@/components/dashboard-navbar';
import { MobileBottomNav } from '@/components/care/mobile-bottom-nav';

export const dynamic = 'force-dynamic';

interface MessagesPageProps {
  searchParams: { conversation?: string };
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const initialConversationId = searchParams.conversation || null;

  return (
    <>
      <DashboardNavbar />
      <MessageCenter userId={user.id} initialConversationId={initialConversationId} />
      <MobileBottomNav />
    </>
  );
}
