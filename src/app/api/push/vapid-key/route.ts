import { NextRequest, NextResponse } from 'next/server';

// VAPID keys should be generated using: npx web-push generate-vapid-keys
// For production, these should be environment variables
// For demo purposes, we'll use placeholder values that should be replaced

export async function GET(request: NextRequest) {
  try {
    // In production, these should come from environment variables
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'REPLACE_WITH_GENERATED_PUBLIC_KEY';

    if (publicKey === 'REPLACE_WITH_GENERATED_PUBLIC_KEY') {
      console.warn('⚠️ VAPID keys not configured. Run: npx web-push generate-vapid-keys');
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID key:', error);
    return NextResponse.json(
      { error: 'Failed to get VAPID key' },
      { status: 500 }
    );
  }
}
