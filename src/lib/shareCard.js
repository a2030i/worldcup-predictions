// بطاقة مشاركة التوقع — تُرسم Canvas بهوية 26 (مربع 1080 أو ستوري 1080×1920)
import { ksaParts } from "./format";

const SITE = "a2030i.github.io/worldcup-predictions";

function quarter(x, cx, cy, r, start, color) {
  x.fillStyle = color;
  x.beginPath();
  x.moveTo(cx, cy);
  x.arc(cx, cy, r, start, start + Math.PI / 2);
  x.closePath();
  x.fill();
}

function rounded(x, rx, ry, w, h, r) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + h, r);
  x.arcTo(rx + w, ry + h, rx, ry + h, r);
  x.arcTo(rx, ry + h, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
}

export async function generateShareCard({ format, teamA, teamB, h, a, displayName, kickoff, points }) {
  const W = 1080, H = format === "story" ? 1920 : 1080;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  try { await document.fonts.ready; } catch {}
  const F = (size, weight = 900) => `${weight} ${size}px Cairo, 'Segoe UI', Tahoma, sans-serif`;
  x.direction = "rtl";
  x.textAlign = "center";
  x.textBaseline = "middle";

  // الخلفية الورقية + كتل 26
  x.fillStyle = "#F7F4ED"; x.fillRect(0, 0, W, H);
  quarter(x, W, 0, format === "story" ? 360 : 300, Math.PI / 2, "#FF8A75");
  quarter(x, 0, 0, format === "story" ? 330 : 270, 0, "#2B6BE4");
  x.fillStyle = "#FFD23F"; x.beginPath(); x.arc(170, format === "story" ? 430 : 330, 64, 0, 7); x.fill();
  quarter(x, W, format === "story" ? 470 : 370, 100, Math.PI / 2, "#19C39C");
  quarter(x, 0, H, format === "story" ? 300 : 240, -Math.PI / 2, "#7C3AED");
  quarter(x, W, H, format === "story" ? 280 : 220, Math.PI, "#19C39C");

  const cx = W / 2;
  let y = format === "story" ? 360 : 240;

  // شريط 26
  const strip = ["#E0432F", "#2B6BE4", "#FFD23F", "#19C39C", "#7C3AED"];
  const sw = 64, gap = 14, total = strip.length * sw + (strip.length - 1) * gap;
  strip.forEach((c, i) => {
    x.fillStyle = c;
    rounded(x, cx - total / 2 + i * (sw + gap), y, sw, 16, 8);
    x.fill();
  });
  y += format === "story" ? 90 : 70;

  x.fillStyle = "#6E6857"; x.font = F(30, 700);
  x.fillText("مونديال 2026 · أمريكا، كندا والمكسيك", cx, y);
  y += format === "story" ? 96 : 78;
  x.fillStyle = "#1B1B20"; x.font = F(format === "story" ? 88 : 76);
  x.fillText("تحدي التوقعات", cx, y);

  // بطاقة المباراة
  const cardW = 880, cardX = cx - cardW / 2;
  const cardH = format === "story" ? 560 : 430;
  y += format === "story" ? 110 : 80;
  x.fillStyle = "#FFFFFF";
  x.strokeStyle = "#E8E2D2"; x.lineWidth = 3;
  rounded(x, cardX, y, cardW, cardH, 44); x.fill(); x.stroke();

  const k = ksaParts(kickoff);
  let iy = y + (format === "story" ? 100 : 80);
  x.fillStyle = "#6E6857"; x.font = F(30, 700);
  x.fillText(`${k.dow} ${k.date} · ${k.t} ${k.p === "م" ? "مساءً" : "صباحًا"} بتوقيت مكة`, cx, iy);

  iy += format === "story" ? 110 : 86;
  x.fillStyle = "#1B1B20"; x.font = F(format === "story" ? 58 : 50);
  x.fillText(`${teamA}   ×   ${teamB}`, cx, iy);

  iy += format === "story" ? 150 : 115;
  x.fillStyle = "#E0432F"; x.font = F(format === "story" ? 170 : 140);
  x.save(); x.direction = "ltr";
  x.fillText(`${h} – ${a}`, cx, iy);
  x.restore();

  iy += format === "story" ? 130 : 100;
  x.fillStyle = "#B8771A"; x.font = F(38);
  x.fillText(`توقُّع ${displayName}`, cx, iy);

  // الدعوة
  y += cardH + (format === "story" ? 130 : 90);
  x.fillStyle = "#1B1B20"; x.font = F(format === "story" ? 52 : 44);
  x.fillText("شاركنا توقعك قبل بداية اللقاء", cx, y);
  y += format === "story" ? 78 : 62;
  x.fillStyle = "#E0432F"; x.font = F(format === "story" ? 52 : 44);
  x.fillText("وخلّنا نتنافس على الصدارة!", cx, y);
  y += format === "story" ? 96 : 72;
  if (points) {
    x.fillStyle = "#6E6857"; x.font = F(30, 700);
    x.fillText(`أصِب النتيجة بالضبط واكسب ${points}`, cx, y);
    y += format === "story" ? 84 : 64;
  }
  x.fillStyle = "#2B6BE4"; x.font = `700 ${format === "story" ? 34 : 30}px 'Segoe UI', Tahoma, sans-serif`;
  x.save(); x.direction = "ltr";
  x.fillText(SITE, cx, y);
  x.restore();

  return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
}

// جوائز التحدي النقدية — مصدر واحد للأرقام (الواجهة + البطاقة)
export const PRIZES = {
  total: 1000,
  places: [
    { rank: 1, label: "المركز الأول", amount: 500, color: "#EF9F27" },
    { rank: 2, label: "المركز الثاني", amount: 350, color: "#C9CCDA" },
    { rank: 3, label: "المركز الثالث", amount: 150, color: "#D8915A" },
  ],
};

// بطاقة جوائز التحدي — طولية لسناب/ستوري (1080×1920) بهوية 26، للمشاركة والدعوة
export async function generatePrizeCard() {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  try { await document.fonts.ready; } catch {}
  const F = (size, weight = 900) => `${weight} ${size}px Cairo, 'Segoe UI', Tahoma, sans-serif`;
  x.direction = "rtl";
  x.textAlign = "center";
  x.textBaseline = "middle";

  // الخلفية الورقية + كتل 26 الهندسية
  x.fillStyle = "#F7F4ED"; x.fillRect(0, 0, W, H);
  quarter(x, W, 0, 360, Math.PI / 2, "#FF8A75");
  quarter(x, 0, 0, 330, 0, "#2B6BE4");
  x.fillStyle = "#FFD23F"; x.beginPath(); x.arc(170, 470, 64, 0, 7); x.fill();
  quarter(x, W, 510, 100, Math.PI / 2, "#19C39C");
  quarter(x, 0, H, 320, -Math.PI / 2, "#7C3AED");
  quarter(x, W, H, 300, Math.PI, "#19C39C");

  const cx = W / 2;
  let y = 360;

  // شريط 26
  const strip = ["#E0432F", "#2B6BE4", "#FFD23F", "#19C39C", "#7C3AED"];
  const sw = 64, gap = 14, total = strip.length * sw + (strip.length - 1) * gap;
  strip.forEach((c, i) => {
    x.fillStyle = c;
    rounded(x, cx - total / 2 + i * (sw + gap), y, sw, 16, 8);
    x.fill();
  });
  y += 92;

  x.fillStyle = "#6E6857"; x.font = F(30, 700);
  x.fillText("مونديال 2026 · أمريكا، كندا والمكسيك", cx, y);
  y += 92;
  x.fillStyle = "#1B1B20"; x.font = F(86);
  x.fillText("تحدي التوقعات", cx, y);
  y += 70;
  x.fillStyle = "#E0432F"; x.font = F(40);
  x.fillText("جوائز نقدية للمتصدّرين", cx, y);

  // صندوق الجوائز
  const cardW = 900, cardX = cx - cardW / 2;
  const cardH = 880;
  y += 80;
  x.fillStyle = "#FFFFFF";
  x.strokeStyle = "#E8E2D2"; x.lineWidth = 3;
  rounded(x, cardX, y, cardW, cardH, 48); x.fill(); x.stroke();

  // إجمالي الجوائز
  let iy = y + 110;
  x.fillStyle = "#6E6857"; x.font = F(34, 700);
  x.fillText("إجمالي الجوائز", cx, iy);
  iy += 150;
  x.fillStyle = "#E0432F"; x.font = F(190);
  x.save(); x.direction = "ltr";
  x.fillText(String(PRIZES.total), cx, iy);
  x.restore();
  iy += 100;
  x.fillStyle = "#B8771A"; x.font = F(46);
  x.fillText("ريال", cx, iy);

  // صفوف المراكز
  iy += 120;
  const rowH = 120, rowGap = 14, pad = 40, r = 34;
  const rowW = cardW - 2 * pad, rowX = cardX + pad;
  PRIZES.places.forEach((p, i) => {
    const ry = iy + i * (rowH + rowGap);
    x.fillStyle = "#F3EFE4";
    rounded(x, rowX, ry, rowW, rowH, 28); x.fill();
    const my = ry + rowH / 2;
    // ميدالية المركز (دائرة ملوّنة بالرقم) عند الطرف الأيمن (بداية RTL)
    const mcx = rowX + rowW - pad / 2 - r;
    x.fillStyle = p.color; x.beginPath(); x.arc(mcx, my, r, 0, 7); x.fill();
    x.fillStyle = "#1A2040"; x.font = F(40); x.textBaseline = "middle";
    x.fillText(String(p.rank), mcx, my + 2);
    // اسم المركز
    x.fillStyle = "#1B1B20"; x.font = F(46, 800); x.textAlign = "right";
    x.fillText(p.label, mcx - r - 28, my);
    // المبلغ عند الطرف الأيسر
    x.fillStyle = "#B8771A"; x.font = F(50); x.textAlign = "left";
    x.save(); x.direction = "ltr";
    x.fillText(`${p.amount} ريال`, rowX + pad / 2, my);
    x.restore();
    x.textAlign = "center";
  });

  // الدعوة
  y += cardH + 110;
  x.fillStyle = "#1B1B20"; x.font = F(52);
  x.fillText("توقّع نتائج المونديال", cx, y);
  y += 76;
  x.fillStyle = "#E0432F"; x.font = F(52);
  x.fillText("ونافس على الصدارة والجوائز!", cx, y);
  y += 90;
  x.fillStyle = "#2B6BE4"; x.font = `700 34px 'Segoe UI', Tahoma, sans-serif`;
  x.save(); x.direction = "ltr";
  x.fillText(SITE, cx, y);
  x.restore();

  return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
}

// مشاركة أصلية على الجوال، وتنزيل على الكمبيوتر
export async function shareBlob(blob, fileName = "توقعي.png") {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "تحدي التوقعات" }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const an = document.createElement("a");
  an.href = url; an.download = fileName;
  document.body.appendChild(an); an.click(); an.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
