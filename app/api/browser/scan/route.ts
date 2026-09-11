import { NextRequest, NextResponse } from 'next/server';
import { scanDirectory } from '@/lib/dicom/dicomIndexer';
import { getFacets } from '@/lib/db/browserQueries';
import fs from 'fs';

let isScanning = false;

export async function POST(req: NextRequest) {
  if (isScanning) {
    return NextResponse.json(
      { error: 'Scan already in progress' },
      { status: 409 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetDir = body.directoryPath || process.env.ALLOWED_DICOM_ROOT;

    if (!targetDir || typeof targetDir !== 'string') {
      return NextResponse.json(
        { error: 'No directory path provided and ALLOWED_DICOM_ROOT is not set' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json(
        { error: `Directory not found: ${targetDir}` },
        { status: 404 }
      );
    }

    isScanning = true;
    const result = await scanDirectory(targetDir);
    isScanning = false;

    const facets = getFacets();

    return NextResponse.json({
      success: true,
      directory: targetDir,
      ...result,
      facets,
    });
  } catch (err: any) {
    isScanning = false;
    return NextResponse.json(
      { error: err.message || 'Error scanning directory' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const facets = getFacets();
  return NextResponse.json({
    isScanning,
    defaultRoot: process.env.ALLOWED_DICOM_ROOT || '',
    facets,
  });
}
