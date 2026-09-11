import { NextRequest, NextResponse } from 'next/server';
import { saveUploadedDicomBuffer } from '@/lib/dicom/dicomIndexer';
import { getFacets } from '@/lib/db/browserQueries';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    let indexedCount = 0;
    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const record = saveUploadedDicomBuffer(buffer, file.name);
        if (record) {
          indexedCount++;
        }
      } catch (err) {
        console.warn(`Error processing file ${file.name}:`, err);
      }
    }

    const facets = getFacets();

    return NextResponse.json({
      success: true,
      indexedCount,
      totalReceived: files.length,
      facets,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error processing uploaded DICOM files' },
      { status: 500 }
    );
  }
}
