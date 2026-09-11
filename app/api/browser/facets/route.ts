import { NextResponse } from 'next/server';
import { getFacets } from '@/lib/db/browserQueries';

export async function GET() {
  try {
    const facets = getFacets();
    return NextResponse.json(facets);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching facets' },
      { status: 500 }
    );
  }
}
