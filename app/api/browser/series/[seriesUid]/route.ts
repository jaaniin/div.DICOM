import { NextRequest, NextResponse } from 'next/server';
import { getSeriesInstances } from '@/lib/db/browserQueries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seriesUid: string }> }
) {
  try {
    const { seriesUid } = await params;
    if (!seriesUid) {
      return NextResponse.json({ error: 'Missing series UID' }, { status: 400 });
    }

    const instances = getSeriesInstances(seriesUid);
    return NextResponse.json({
      seriesInstanceUid: seriesUid,
      instanceCount: instances.length,
      instances,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching series instances' },
      { status: 500 }
    );
  }
}
