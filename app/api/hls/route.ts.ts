/* ═══════════ مستورد قوائم القنوات الخارجية (m3u / m3u_plus / get.php) ═══════════
   الاستخدام: /api/playlist?url=<رابط القائمة>&sports=1
   ─ يجلب ملف القائمة من المزود (بدون مشاكل CORS) ويفكه إلى قنوات: اسم + شعار + مجموعة + رابط
   ─ يحول روابط Xtream النهائية (.ts) إلى (.m3u8) حتى تعمل بمشغل HLS داخل التطبيق
   ─ يرتب القنوات: الوان سبورت أولاً ثم beIN SPORTS 1-9 ثم بقية beIN ثم الرياضية ثم الباقي
   ─ sports=1 يرشح القنوات الرياضية فقط (أنسب وأخف لتطبيق رياضي) ═══════════ */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const H_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function normName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim();
}

const RE_BEIN = /be ?in|بي ان|بين/;
const RE_ALWAN = /alwan|الوان|ألوان/;
const RE_SPORT = /sport|رياض|كوره|كرة|football|futbol|soccer|be ?in|بي ان|بين|alwan|الوان|ألوان/;

/* رقم قناة الوان الرئيسية (1-9) */
function alwanMainNum(n: string): number | null {
  if (!RE_ALWAN.test(n)) return null;
  const m = n.match(/(\d+)/);
  if (!m) return null;
  const k = parseInt(m[1], 10);
  return k >= 1 && k <= 9 ? k : null;
}

/* رقم قناة beIN الرئيسية (1-9) بدون MAX/PREMIUM/XTRA/NEWS وغيرها */
function beinMainNum(n: string): number | null {
  if (!RE_BEIN.test(n)) return null;
  if (/max|premium|xtra|extra|news|نيوز|4k|afcon|asian|اسيا/.test(n)) return null;
  const m = n.match(/(\d+)/);
  if (!m) return null;
  const k = parseInt(m[1], 10);
  return k >= 1 && k <= 9 ? k : null;
}

/* درجة الترتيب: الوان 1 = 1 ... الوان 9 = 9، بقية الوان = 10، beIN 1 = 21 ... beIN 9 = 29، بقية beIN = 40، الرياضية = 60، الباقي = 80 */
function scoreOf(name: string, group: string): number {
  const n = normName(name);
  const g = normName(group);
  const an = alwanMainNum(n) ?? (RE_ALWAN.test(n) || RE_ALWAN.test(g) ? alwanMainNum(g) : null);
  if (an !== null) return an;
  if (RE_ALWAN.test(n) || RE_ALWAN.test(g)) return 10;
  const num = beinMainNum(n) ?? (RE_BEIN.test(n) || RE_BEIN.test(g) ? beinMainNum(g) : null);
  if (num !== null) return 20 + num;
  if (RE_BEIN.test(n) || RE_BEIN.test(g)) return 40;
  if (RE_SPORT.test(n) || RE_SPORT.test(g)) return 60;
  return 80;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: H_CORS });
}

/* غلاف صغير للردود مع CORS */
function jsonWrap(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...H_CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url") || "";
  const sportsOnly = searchParams.get("sports") === "1";
  if (!/^https?:\/\//i.test(target)) {
    return jsonWrap({ ok: false, error: "bad url" }, 400);
  }

  let text = "";
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": UA, "Accept": "*/*" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      return jsonWrap({ ok: false, error: "المزود رد بكود " + res.status }, 502);
    }
    text = await res.text();
  } catch {
    return jsonWrap({ ok: false, error: "تعذر الوصول لرابط القائمة — تأكد من الرابط أو جرب بعدين" }, 502);
  }

  if (!/#EXTM3U|#EXTINF/i.test(text)) {
    return jsonWrap({ ok: false, error: "هذا الرابط ما يبدو ملف m3u — تأكد إنك حاط رابط القائمة الصحيح (type=m3u_plus)" }, 502);
  }

  /* ═══ فك الملف: كل #EXTINF يتبعه سطر الرابط ═══ */
  const out: Array<{ name: string; logo: string; group: string; url: string }> = [];
  let name = "";
  let logo = "";
  let group = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#EXTINF/i.test(line)) {
      const gm = line.match(/group-title="([^"]*)"/i);
      group = gm ? gm[1] : "";
      const lm = line.match(/tvg-logo="([^"]*)"/i);
      logo = lm ? lm[1] : "";
      /* الاسم يأتي بعد أول فاصلة تلي آخر اقتباس — حتى نتجاهل الفواصل داخل الخصائص */
      const q = line.lastIndexOf('"');
      const ci = q >= 0 ? line.indexOf(",", q) : line.indexOf(",");
      name = ci >= 0 ? line.slice(ci + 1).trim() : (line.match(/tvg-name="([^"]*)"/i)?.[1] ?? "");
    } else if (/^#EXTGRP/i.test(line)) {
      const g2 = line.replace(/^#EXTGRP:?/i, "").trim();
      if (g2) group = g2;
    } else if (line.charAt(0) === "#") {
      continue;
    } else if (name) {
      let url = line;
      /* روابط Xtream النهائية بتحويل: /live/.../*.ts → .m3u8 (HLS.js يشتغل عليها) */
      if (/\/live\//i.test(url) && /\.ts(\?|$)/i.test(url)) {
        url = url.replace(/\.ts(\?.*)?$/i, ".m3u8$1");
      }
      if (/^https?:\/\//i.test(url) && name.trim()) {
        out.push({ name: name.trim(), logo, group, url });
      }
      name = "";
      logo = "";
    }
  }

  if (!out.length) {
    return jsonWrap({ ok: false, error: "انقرأ الملف بس ما اكتشفنا قنوات فيه" }, 502);
  }

  /* ═══ ترشيح الرياضية فقط (اختياري) ═══ */
  let list = out;
  if (sportsOnly) {
    list = out.filter((c) => RE_SPORT.test(normName(c.name)) || RE_SPORT.test(normName(c.group)));
    if (!list.length) list = out; /* لو ما لقينا رياضية نرجع الكل */
  }

  /* ═══ إزالة التكرار (نفس الاسم والرابط) ═══ */
  const seen = new Set<string>();
  list = list.filter((c) => {
    const k = normName(c.name) + "|" + c.url;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  /* ═══ الترتيب: الوان أولاً ثم beIN 1-9 ثم بقية beIN ثم الرياضية ثم الباقي ═══ */
  const withScore = list.map((c, i) => ({ c, i, s: scoreOf(c.name, c.group) }));
  withScore.sort((a, b) => a.s - b.s || a.i - b.i);
  const cap = sportsOnly ? 900 : 4000;
  const channels = withScore.slice(0, cap).map((x) => x.c);

  return jsonWrap(
    { ok: true, total: out.length, count: channels.length, sportsOnly, channels },
    200
  );
}
