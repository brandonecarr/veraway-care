import { NextResponse } from 'next/server';
import { createClient } from '../../../../supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all unique tags from issues
    const { data: issues, error } = await supabase
      .from('issues')
      .select('tags')
      .not('tags', 'is', null);

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }

    // Extract and deduplicate all tags
    const allTags = new Set<string>();
    issues?.forEach((issue) => {
      if (issue.tags && Array.isArray(issue.tags)) {
        issue.tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim().toLowerCase());
          }
        });
      }
    });

    // Convert to sorted array
    const uniqueTags = Array.from(allTags).sort();

    return NextResponse.json({ tags: uniqueTags });
  } catch (error) {
    console.error('Error in tags API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
