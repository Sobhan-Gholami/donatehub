import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};

const UPLOADS_ROOT = path.join(process.cwd(), "data", "uploads");

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Prevent path traversal outside the uploads directory.
  const safeSegments = segments.filter((s) => s !== ".." && s !== ".");
  const filePath = path.join(UPLOADS_ROOT, ...safeSegments);
  if (!filePath.startsWith(UPLOADS_ROOT)) {
    return NextResponse.json({ error: "مسیر نامعتبر" }, { status: 400 });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);

  return new NextResponse(data as any, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
