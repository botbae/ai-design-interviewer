import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { text } = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("PDF parse failed:", err);
    return NextResponse.json({ error: "PDF parsing failed" }, { status: 500 });
  }
}
