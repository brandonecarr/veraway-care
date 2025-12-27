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
    const {
      facility_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      email,
    } = body;

    if (!facility_id) {
      return NextResponse.json(
        { error: 'Facility ID is required' },
        { status: 400 }
      );
    }

    // Verify the user belongs to this facility
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.facility_id !== facility_id) {
      return NextResponse.json(
        { error: 'You do not have permission to update this facility' },
        { status: 403 }
      );
    }

    // Update the facility information
    const { error: updateError } = await supabase
      .from('facilities')
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
      .eq('id', facility_id);

    if (updateError) {
      console.error('Error updating facility:', updateError);
      return NextResponse.json(
        { error: 'Failed to update facility information' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Facility information updated successfully',
    });
  } catch (error) {
    console.error('Error in update-facility API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
