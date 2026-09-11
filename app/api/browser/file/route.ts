import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let filePath = searchParams.get('path');
    const sopUid = searchParams.get('sopUid');

    if (!filePath && sopUid) {
      const db = getDb();
      const row = db.prepare('SELECT file_path FROM dicom_inbox WHERE sop_instance_uid = ?').get(sopUid) as any;
      if (row) {
        filePath = row.file_path;
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path or sopUid' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/dicom',
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error streaming file' },
      { status: 500 }
    );
  }
}
