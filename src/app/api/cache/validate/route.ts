import { NextRequest, NextResponse } from 'next/server';
import { validateCachePath } from '@/lib/server/cacheIndex';

export const runtime = 'nodejs';

type CacheValidationRequest = {
  source?: 'default' | 'custom';
  path?: string;
  archives?: string[];
};

export async function POST(request: NextRequest) {
  let body: CacheValidationRequest;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { valid: false, message: 'Invalid cache validation request.' },
      { status: 400 }
    );
  }

  const archiveNames = Array.isArray(body.archives)
    ? Array.from(new Set(body.archives.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim().toLowerCase())))
    : [];

  if (body.source === 'default') {
    return NextResponse.json({
      source: 'default',
      valid: true,
      path: null,
      message: 'Using the default RSMap static tile source. Select a custom local cache to query archive existence.',
      mapArchiveCount: null,
      indexCount: null,
      archiveStatus: Object.fromEntries(archiveNames.map((archiveName) => [archiveName, null])),
    });
  }

  if (body.source !== 'custom' || !body.path) {
    return NextResponse.json(
      {
        source: body.source ?? 'custom',
        valid: false,
        path: body.path ?? null,
        message: 'Invalid cache path or unsupported cache format.',
        mapArchiveCount: 0,
        indexCount: 0,
        archiveStatus: {},
      },
      { status: 400 }
    );
  }

  const result = validateCachePath(body.path, archiveNames);
  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
