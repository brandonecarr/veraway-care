import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../supabase/server';
import { getPatientConversation } from '@/lib/messages';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { patientId } = await params;

    const conversation = await getPatientConversation(patientId);

    if (!conversation) {
      return NextResponse.json(
        { error: 'No conversation found for this patient' },
        { status: 404 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Get patient conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}
