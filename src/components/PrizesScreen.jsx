import React, { useEffect, useState } from "react";
import { C } from "../theme";
import { NAMES } from "../data/tournament";
import { myPrizes, prizeOptions, claimPrize } from "../lib/api";
import { countWord } from "../lib/format";
import { GiftIcon, CopyIcon, BackIcon, TrophyIcon } from "../icons.jsx";

const matchLabel = (matchId) => {
  const [, a, b] = matchId.split("_");
  return `${NAMES[a] || a} × ${NAMES[b] || b}`;
};

const btn = (primary) => ({
  cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5,
  padding: "11px 16px", borderRadius: 12,
  border: primary ? "none" : `1px solid ${C.line}`,
  color: primary ? "#FFFFFF" : C.muted,
  background: primary ? "#E0432F" : "transparent",
  display: "inline-flex", alignItems: "center", gap: 6,
});

/* اختيار المتجر لجائزة معلقة — قرار نهائي لا يتكرر */
function StorePicker({ prize, onBack, onClaimed }) {
  const [options, setOptions] = useState(null);
  const [confirming, setConfirming] = useState(null); // متجر بانتظار التأكيد
  const [err, setErr] = useState("");

  useEffect(() => { prizeOptions(prize.id).then(setOptions).catch((e) => setErr(e.message)); }, [prize.id]);

  return (
    <div className="block">
      <button onClick={onBack} style={btn(false)}><BackIcon size={15} /> رجوع لجوائزي</button>
      <h2 style={{ color: C.text, fontWeight: 900, fontSize: 19, margin: "14px 0 4px" }}>اختر جائزتك</h2>
      <p style={{ color: C.muted, fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.8 }}>
        عن توقعك الصحيح في {matchLabel(prize.match_id)} — اختر متجرًا واحدًا ليظهر لك كوبونه.
        <b style={{ color: C.gold }}> كل متجر يُختار مرة واحدة فقط</b>، فاختر بعناية.
      </p>
      {err && <p style={{ color: C.red, fontSize: 13, textAlign: "center" }}>{err}</p>}
      {!options && !err && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
      {options?.length === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, textAlign: "center", color: C.muted, fontSize: 13, lineHeight: 1.9 }}>
          اخترت كل المتاجر المتاحة سابقًا — جائزتك محفوظة هنا وستظهر خيارات جديدة فور إضافة متاجر.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {options?.map((s) => (
          <div key={s.id} style={{ background: C.card, border: `1px solid ${confirming === s.id ? "#E0432F" : C.line}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{s.name}</div>
            <div style={{ color: C.gold, fontSize: 12.5, fontWeight: 800 }}>{s.discount_text}</div>
            {s.description && <div style={{ color: C.muted, fontSize: 11.5, lineHeight: 1.7, flex: 1 }}>{s.description}</div>}
            <button style={{ ...btn(confirming === s.id), justifyContent: "center", padding: "9px 10px", fontSize: 12.5 }}
              onClick={async () => {
                if (confirming !== s.id) { setConfirming(s.id); setTimeout(() => setConfirming((c) => (c === s.id ? null : c)), 4000); return; }
                try { onClaimed(await claimPrize(prize.id, s.id)); }
                catch (e) { setErr(e.message); setConfirming(null); }
              }}>
              {confirming === s.id ? "تأكيد الاختيار النهائي؟" : "أختار هذا المتجر"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* كشف الكوبون بعد الاستلام */
function Reveal({ claim, onDone }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="block" style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ color: "#E0432F" }}><GiftIcon size={46} style={{ strokeWidth: 1.4 }} /></div>
      <h2 style={{ color: C.text, fontWeight: 900, fontSize: 20, margin: "10px 0 2px" }}>مبروك! جائزتك من {claim.store_name}</h2>
      <p style={{ color: C.gold, fontWeight: 800, fontSize: 14, margin: "0 0 14px" }}>{claim.discount_text}</p>
      <div dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.card, border: `2px dashed #E0432F`, borderRadius: 14, padding: "12px 20px" }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: C.text }}>{claim.coupon_code}</span>
        <button aria-label="نسخ الكوبون" style={{ ...btn(false), padding: "8px 10px" }} onClick={async () => {
          try { await navigator.clipboard.writeText(claim.coupon_code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
        }}><CopyIcon size={15} /> {copied ? "نُسخ ✓" : "نسخ"}</button>
      </div>
      {claim.description && <p style={{ color: C.muted, fontSize: 12.5, margin: "12px auto 0", maxWidth: 380, lineHeight: 1.8 }}>{claim.description}</p>}
      {claim.url && (
        <p style={{ margin: "12px 0 0" }}>
          <a href={claim.url} target="_blank" rel="noreferrer" style={{ color: "#2B6BE4", fontSize: 13, fontWeight: 800 }}>زيارة المتجر ←</a>
        </p>
      )}
      <p style={{ color: C.muted, fontSize: 11.5, margin: "14px 0 0" }}>الكوبون محفوظ دائمًا في جوائزي — لن تفقده.</p>
      <button style={{ ...btn(true), marginTop: 14 }} onClick={onDone}>تم</button>
    </div>
  );
}

export default function PrizesScreen({ onChanged }) {
  const [data, setData] = useState(null);
  const [picking, setPicking] = useState(null); // الجائزة المعلقة قيد الاختيار
  const [reveal, setReveal] = useState(null);   // كوبون كُشف للتو
  const [copiedId, setCopiedId] = useState(null);
  const [err, setErr] = useState("");

  const load = () => myPrizes().then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (reveal) return <Reveal claim={reveal} onDone={() => { setReveal(null); setPicking(null); load(); onChanged?.(); }} />;
  if (picking) return <StorePicker prize={picking} onBack={() => setPicking(null)} onClaimed={setReveal} />;

  return (
    <div className="block">
      {err && <p style={{ color: C.red, fontSize: 13, textAlign: "center" }}>{err}</p>}
      {!data && !err && <p style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>جاري التحميل...</p>}
      {data && (
        <>
          {data.pending.length === 0 && data.claimed.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 10px", color: C.muted }}>
              <GiftIcon size={40} style={{ strokeWidth: 1.4 }} />
              <p style={{ fontSize: 14, fontWeight: 700, margin: "10px 0 4px", color: C.text }}>لا جوائز بعد</p>
              <p style={{ fontSize: 12.5, lineHeight: 1.9, margin: 0 }}>
                أصِب نتيجة أي مباراة بالضبط واكسب كوبون خصم حقيقيًا من متجر تختاره!
              </p>
            </div>
          )}

          {data.pending.length > 0 && (
            <>
              <h3 style={{ color: C.text, fontWeight: 900, fontSize: 15, margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ color: "#E0432F" }}><GiftIcon size={17} /></span>
                بانتظار اختيارك ({data.pending.length})
              </h3>
              {data.pending.map((p) => (
                <div key={p.id} style={{ background: C.card, border: "2px solid rgba(224,67,47,0.45)", borderRadius: 16, padding: "13px 15px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 150 }}>
                    <span style={{ display: "block", color: C.text, fontWeight: 800, fontSize: 14 }}>توقع صحيح — {matchLabel(p.match_id)}</span>
                    <span style={{ color: C.muted, fontSize: 11.5 }}>اختر متجرًا ليظهر كوبونك</span>
                  </span>
                  <button style={btn(true)} onClick={() => setPicking(p)}>اختر جائزتك</button>
                </div>
              ))}
            </>
          )}

          {data.claimed.length > 0 && (
            <>
              <h3 style={{ color: C.text, fontWeight: 900, fontSize: 15, margin: "18px 0 10px", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ color: C.gold }}><TrophyIcon size={17} /></span>
                {countWord(data.claimed.length, "جائزة مستلمة", "جائزتان مستلمتان", "جوائز مستلمة")}
              </h3>
              {data.claimed.map((p) => (
                <div key={p.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "13px 15px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{p.store_name}</span>
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: 12.5 }}>{p.discount_text}</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 11.5, marginTop: 2 }}>عن {matchLabel(p.match_id)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span dir="ltr" className="num" style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1.5, background: "#F3EFE4", border: `1px dashed ${C.gold}`, borderRadius: 9, padding: "6px 12px", color: C.text }}>{p.coupon_code}</span>
                    <button style={{ ...btn(false), padding: "7px 11px", fontSize: 12 }} onClick={async () => {
                      try { await navigator.clipboard.writeText(p.coupon_code); setCopiedId(p.id); setTimeout(() => setCopiedId(null), 2000); } catch {}
                    }}><CopyIcon size={13} /> {copiedId === p.id ? "نُسخ ✓" : "نسخ"}</button>
                    {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "#2B6BE4", fontSize: 12.5, fontWeight: 800 }}>المتجر ←</a>}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
