import { NextRequest, NextResponse } from 'next/server';
import { getStudyInstances } from '@/lib/db/browserQueries';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studyUid: string }> }
) {
  try {
    const { studyUid } = await params;
    if (!studyUid) {
      return NextResponse.json({ error: 'Missing study UID' }, { status: 400 });
    }

    const instances = getStudyInstances(studyUid);
    return NextResponse.json({
      studyInstanceUid: studyUid,
      instanceCount: instances.length,
      instances,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching study instances' },
      { status: 500 }
    );
  }
}
