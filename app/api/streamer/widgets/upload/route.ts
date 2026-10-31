import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import path from "path";
import fs from "fs";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const WIDGET_TYPES = ["goal", "donors", "donations", "alert"];
const ALLOWED_MEDIA = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm"];
const ALLOWED_SOUND = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm"];

function extFromMime(mime: string) {
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/webm": "webm",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm",
  };
  return map[mime] || "bin";
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const form = await req.formData();
  const widgetType = String(form.get("widget_type") || "");
  const kind = String(form.get("kind") || ""); // 'media' | 'sound'
  const tierIndexRaw = form.get("tier_index");
  const tierIndex = tierIndexRaw !== null && tierIndexRaw !== "" ? Number(tierIndexRaw) : null;
  const file = form.get("file") as File | null;

  if (!WIDGET_TYPES.includes(widgetType)) return NextResponse.json({ error: "نوع ویجت نامعتبر" }, { status: 400 });
  if (!["media", "sound"].includes(kind)) return NextResponse.json({ error: "نوع فایل نامعتبر" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "فایلی انتخاب نشده" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۱۰ مگابایت باشد" }, { status: 400 });

  // Goal widget backgrounds are static images or looping GIFs only — no mp4,
  // since a GIF already loops natively and is simpler for a background layer.
  const allowedList = kind === "sound"
    ? ALLOWED_SOUND
    : widgetType === "goal"
      ? ALLOWED_MEDIA.filter((m) => m.startsWith("image/"))
      : ALLOWED_MEDIA;
  if (!allowedList.includes(file.type)) {
    const msg = widgetType === "goal" && kind === "media"
      ? "تصویر پس‌زمینه هدف باید عکس یا گیف لوپ‌شونده باشه (ویدیو mp4 پشتیبانی نمیشه)"
      : "فرمت فایل پشتیبانی نمی‌شود";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "data", "uploads", String(s.id));
  fs.mkdirSync(dir, { recursive: true });
  const ext = extFromMime(file.type);
  const filename = `${widgetType}-${kind}-${tierIndex ?? "x"}-${Date.now()}.${ext}`;
  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const publicUrl = `/api/uploads/${s.id}/${filename}`;
  const mediaType = file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "image" : null;

  const existing = db.prepare("SELECT * FROM widget_configs WHERE streamer_id = ? AND widget_type = ?").get(s.id, widgetType) as any;

  // Alert widget tiers: media/sound live inside config_json.tiers[i], not the
  // top-level columns, since each amount tier has its own file.
  if (widgetType === "alert" && tierIndex !== null) {
    const config = existing ? JSON.parse(existing.config_json) : {};
    const tiers: any[] = Array.isArray(config.tiers) ? config.tiers : [];
    while (tiers.length <= tierIndex) tiers.push({ max_amount: 0, media_url: null, media_type: null, sound_url: null, volume: 0.5 });
    if (kind === "media") { tiers[tierIndex].media_url = publicUrl; tiers[tierIndex].media_type = mediaType; }
    else { tiers[tierIndex].sound_url = publicUrl; }
    config.tiers = tiers;

    if (!existing) {
      db.prepare("INSERT INTO widget_configs (streamer_id, widget_type, config_json) VALUES (?,?,?)")
        .run(s.id, widgetType, JSON.stringify(config));
    } else {
      db.prepare("UPDATE widget_configs SET config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(JSON.stringify(config), existing.id);
    }
    return NextResponse.json({ ok: true, url: publicUrl, media_type: mediaType });
  }

  if (kind === "media") {
    if (!existing) {
      db.prepare("INSERT INTO widget_configs (streamer_id, widget_type, media_url, media_type) VALUES (?,?,?,?)")
        .run(s.id, widgetType, publicUrl, mediaType);
    } else {
      db.prepare("UPDATE widget_configs SET media_url = ?, media_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(publicUrl, mediaType, existing.id);
    }
  } else {
    if (!existing) {
      db.prepare("INSERT INTO widget_configs (streamer_id, widget_type, sound_url) VALUES (?,?,?)")
        .run(s.id, widgetType, publicUrl);
    } else {
      db.prepare("UPDATE widget_configs SET sound_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(publicUrl, existing.id);
    }
  }

  return NextResponse.json({ ok: true, url: publicUrl, media_type: mediaType });
}
