import { NextRequest, NextResponse } from 'next/server';
import { getStudiesWithSeries, StudyFilters } from '@/lib/db/browserQueries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const filters: StudyFilters = {
      modality: searchParams.get('modality') || undefined,
      orientation: searchParams.get('orientation') || undefined,
      search: searchParams.get('search') || undefined,
      minSlices: searchParams.get('minSlices') ? parseInt(searchParams.get('minSlices')!, 10) : undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'studyDate',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    };

    const studies = getStudiesWithSeries(filters);

    return NextResponse.json({
      studies,
      totalStudies: studies.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching studies' },
      { status: 500 }
    );
  }
}
