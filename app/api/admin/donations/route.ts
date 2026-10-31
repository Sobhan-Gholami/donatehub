import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const method = searchParams.get("method"); // toman|forex|crypto
  const status = searchParams.get("status");
  const streamerId = searchParams.get("streamer_id");

  let query = `
    SELECT d.*, s.display_name AS streamer_name, s.slug AS streamer_slug
    FROM donations d JOIN streamers s ON s.id = d.streamer_id
    WHERE 1=1
  `;
  const vals: any[] = [];
  if (method) { query += " AND d.method = ?"; vals.push(method); }
  if (status) { query += " AND d.status = ?"; vals.push(status); }
  if (streamerId) { query += " AND d.streamer_id = ?"; vals.push(streamerId); }
  query += " ORDER BY d.created_at DESC LIMIT 500";

  const donations = db.prepare(query).all(...vals);
  return NextResponse.json({ donations });
}
