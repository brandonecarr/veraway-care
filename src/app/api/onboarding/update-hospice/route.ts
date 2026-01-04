import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    // Support both hospice_id and facility_id for backwards compatibility
    const hospiceId = body.hospice_id || body.facility_id;
    const {
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      email,
    } = body;

    if (!hospiceId) {
      return NextResponse.json(
        { error: 'Hospice ID is required' },
        { status: 400 }
      );
    }

    // Verify the user belongs to this hospice
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('hospice_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.hospice_id !== hospiceId) {
      return NextResponse.json(
        { error: 'You do not have permission to update this hospice' },
        { status: 403 }
      );
    }

    // Update the hospice information
    const { error: updateError } = await supabase
      .from('hospices')
      .update({
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hospiceId);

    if (updateError) {
      console.error('Error updating hospice:', updateError);
      return NextResponse.json(
        { error: 'Failed to update hospice information' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hospice information updated successfully',
    });
  } catch (error) {
    console.error('Error in update-hospice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
