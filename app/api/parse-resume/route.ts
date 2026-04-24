import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error('[parse-resume] pdf-parse failed:', err);
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 422 });
  }
}
