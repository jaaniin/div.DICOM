import { NextRequest, NextResponse } from 'next/server';
import { getMultipleSeriesInstances, getStudyInstances } from '@/lib/db/browserQueries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesUidsParam = searchParams.get('seriesUids') || searchParams.get('series');
    const studyUidsParam = searchParams.get('studyUids') || searchParams.get('studies');

    const seriesUids = seriesUidsParam ? seriesUidsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const studyUids = studyUidsParam ? studyUidsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const instancesMap = new Map<string, any>();

    if (seriesUids.length > 0) {
      const sInstances = getMultipleSeriesInstances(seriesUids);
      for (const inst of sInstances) {
        instancesMap.set(inst.sopInstanceUid, inst);
      }
    }

    if (studyUids.length > 0) {
      for (const stdUid of studyUids) {
        const stdInstances = getStudyInstances(stdUid);
        for (const inst of stdInstances) {
          instancesMap.set(inst.sopInstanceUid, inst);
        }
      }
    }

    const instances = Array.from(instancesMap.values());
    return NextResponse.json({
      instanceCount: instances.length,
      instances,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching batch instances' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const seriesUids: string[] = Array.isArray(body.seriesUids) ? body.seriesUids : [];
    const studyUids: string[] = Array.isArray(body.studyUids) ? body.studyUids : [];

    const instancesMap = new Map<string, any>();

    if (seriesUids.length > 0) {
      const sInstances = getMultipleSeriesInstances(seriesUids);
      for (const inst of sInstances) {
        instancesMap.set(inst.sopInstanceUid, inst);
      }
    }

    if (studyUids.length > 0) {
      for (const stdUid of studyUids) {
        const stdInstances = getStudyInstances(stdUid);
        for (const inst of stdInstances) {
          instancesMap.set(inst.sopInstanceUid, inst);
        }
      }
    }

    const instances = Array.from(instancesMap.values());
    return NextResponse.json({
      instanceCount: instances.length,
      instances,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching batch instances' },
      { status: 500 }
    );
  }
}
