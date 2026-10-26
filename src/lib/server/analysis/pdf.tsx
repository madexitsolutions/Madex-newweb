/**
 * The report as a designed A4 PDF, rendered on the server (no browser print
 * dialog: no browser headers/footers, no cut blocks, always in German).
 *
 * Page 1  Overview: score, verdict, all areas, contents
 * Page 2  The three most effective improvements and strengths
 * Page 3  Google measurement with the screenshots (only with PageSpeed data)
 * Then    All checks by area, closing with the contact block
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  CATEGORIES,
  closingText,
  scoreLabel,
  type Check,
  type Lighthouse,
  type Recommendation,
} from "@/lib/analysis";
import { site } from "@/content/site";
import type { Report } from "./engine";

const C = {
  ink: "#01292d",
  soft: "#4f6164",
  mute: "#7d8b8d",
  line: "#e3e9e9",
  paper: "#f4f8f8",
  mint: "#e3f3f1",
  petrol: "#025159",
  night: "#01363b",
  teal: "#027872",
  good: "#1f8a5b",
  fair: "#027872",
  weak: "#9a6400",
  poor: "#b3261e",
};
const tone = (n: number) =>
  n >= 85 ? C.good : n >= 60 ? C.fair : n >= 40 ? C.weak : C.poor;
const toneDark = (n: number) =>
  n >= 85 ? "#45d39a" : n >= 60 ? "#4fe0d2" : n >= 40 ? "#ffbe11" : "#ff7a6b";
const STATUS = {
  ok: { c: C.good, t: "In Ordnung" },
  warn: { c: "#b87500", t: "Verbesserungsfähig" },
  bad: { c: "#c0392b", t: "Handlungsbedarf" },
  info: { c: "#5b7579", t: "Hinweis" },
} as const;
const IMPACT: Record<Recommendation["impact"], [string, string]> = {
  hoch: ["#fde7e4", "#8a1c14"],
  mittel: ["#fff1cc", "#6b4a00"],
  niedrig: ["#e9efef", C.soft],
};

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "public", "fonts", "pdf");
  Font.register({
    family: "Schibsted",
    fonts: [
      { src: path.join(dir, "schibsted-grotesk-400.woff"), fontWeight: 400 },
      { src: path.join(dir, "schibsted-grotesk-500.woff"), fontWeight: 500 },
      { src: path.join(dir, "schibsted-grotesk-700.woff"), fontWeight: 700 },
    ],
  });
  // whole words only – German compound words look broken when hyphenated
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Schibsted",
    fontSize: 9.5,
    color: C.ink,
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  cover: { paddingTop: 40 },
  head: {
    position: "absolute",
    top: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headText: { fontSize: 8, color: C.mute },
  foot: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.mute,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  h1: { fontSize: 20, fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  lead: { fontSize: 9.5, color: C.soft, marginBottom: 14, lineHeight: 1.4 },
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 8,
    fontSize: 7.5,
    fontWeight: 700,
  },
});

/* ---------------------------------------------------------------- pieces */


function Ring({ value, size = 92 }: { value: number; size?: number }) {
  const r = size / 2 - 7;
  const c = size / 2;
  const a = (Math.min(99.99, Math.max(0.01, value)) / 100) * 2 * Math.PI;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Path
          d={`M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r}`}
          stroke="#0e4c52"
          strokeWidth={9}
          fill="none"
        />
        <Path
          d={`M ${c} ${c - r} A ${r} ${r} 0 ${value > 50 ? 1 : 0} 1 ${x} ${y}`}
          stroke={toneDark(value)}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {value}
        </Text>
        <Text style={{ fontSize: 7.5, color: "#a9c9c6", marginTop: 2 }}>
          von 100
        </Text>
      </View>
    </View>
  );
}

function Bar({
  value,
  color,
  height = 5,
}: {
  value: number;
  color: string;
  height?: number;
}) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.line }}>
      <View
        style={{
          width: `${Math.max(2, value)}%`,
          height,
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function StatusDot({ status }: { status: Check["status"] }) {
  const d =
    status === "ok"
      ? "M4.5 8.2 L7 10.6 L11.6 5.6"
      : status === "bad"
        ? "M5.4 5.4 L10.6 10.6 M10.6 5.4 L5.4 10.6"
        : status === "warn"
          ? "M8 4.6 L8 9 M8 11.2 L8 11.4"
          : "M8 7.4 L8 11.4 M8 4.8 L8 5";
  return (
    <Svg width={12} height={12} viewBox="0 0 16 16">
      <Path d="M8 0.5 A7.5 7.5 0 1 1 7.99 0.5 Z" fill={STATUS[status].c} />
      <Path
        d={d}
        stroke="#fff"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Header({ title, domain }: { title: string; domain: string }) {
  return (
    <View style={s.head} fixed>
      <Text style={{ fontSize: 9, fontWeight: 700, color: C.petrol }}>
        {title}
      </Text>
      <Text style={s.headText}>Website-Analyse · {domain}</Text>
    </View>
  );
}

function Footer() {
  const c = site.contact;
  return (
    <View style={s.foot} fixed>
      <Text>
        {site.legalName} · {c.street} · {c.postalCode} {c.locality} ·{" "}
        {c.phonePrimary.label} · {site.url.replace(/^https?:\/\//, "")}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} von ${totalPages}`
        }
      />
    </View>
  );
}

/* ---------------------------------------------------------------- pages */

const dateFmt = new Intl.DateTimeFormat("de-CH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

function ReportPdf({
  r,
  shots,
  logo,
  url,
}: {
  r: Report;
  shots: { mobile?: string; desktop?: string };
  logo: Buffer;
  url: string;
}) {
  const sc = r.scores!;
  const ins = r.insights!;
  const date = dateFmt.format(new Date(r.createdAt));
  const cats = CATEGORIES.filter((c) => typeof sc[c.key] === "number");
  const counts = {
    bad: r.checks.filter((x) => x.status === "bad").length,
    warn: r.checks.filter((x) => x.status === "warn").length,
    ok: r.checks.filter((x) => x.status === "ok").length,
  };
  const lh = r.lighthouse;
  const hasGoogle = Boolean(lh && (lh.mobile || lh.desktop));
  const order = (c: Check) =>
    ({ bad: 0, warn: 1, ok: 2, info: 3 })[c.status] * 10 - c.weight;
  const contents = [
    ["Übersicht und Punkte", 1],
    ["Die wichtigsten Verbesserungen", 2],
    ...(hasGoogle ? [["Messung von Google (Smartphone und Desktop)", 3]] : []),
    ["Alle Prüfpunkte im Detail", hasGoogle ? 4 : 3],
  ] as [string, number][];

  return (
    <Document
      title={`Website-Analyse ${r.domain}`}
      author={site.legalName}
      subject={`Website-Analyse ${r.domain}, ${date}`}
      language="de-CH"
    >
      {/* 1 · overview */}
      <Page size="A4" style={[s.page, s.cover]}>
        <Footer />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image, no alt attribute */}
            <Image src={logo} style={{ width: 120 }} />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>
                Website-Analyse
              </Text>
              <Text style={{ fontSize: 8.5, color: C.soft }}>{date}</Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: C.night,
              borderRadius: 12,
              padding: 22,
              flexDirection: "row",
              gap: 20,
              marginBottom: 22,
            }}
          >
            <View style={{ alignItems: "center", gap: 8 }}>
              <Ring value={sc.overall} />
              <Text
                style={[
                  s.pill,
                  { color: toneDark(sc.overall), backgroundColor: "#0b4a50" },
                ]}
              >
                {scoreLabel(sc.overall)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 8.5, color: "#a9c9c6", marginBottom: 6 }}
              >
                Ergebnis für{" "}
                <Link
                  src={r.url}
                  style={{ color: "#4fe0d2", textDecoration: "none" }}
                >
                  {r.domain}
                </Link>
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1.25,
                  marginBottom: 8,
                }}
              >
                {ins.headline}
              </Text>
              <Text
                style={{
                  fontSize: 9.5,
                  color: "#d9ecea",
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                {ins.summary}
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {(
                  [
                    ["#ff7a6b", `${counts.bad} mit Handlungsbedarf`],
                    ["#ffbe11", `${counts.warn} verbesserungsfähig`],
                    ["#45d39a", `${counts.ok} in Ordnung`],
                  ] as const
                ).map(([col, t]) => (
                  <View
                    key={t}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: col,
                      }}
                    />
                    <Text style={{ fontSize: 8, color: "#a9c9c6" }}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Text style={s.h2}>Ihre Werte im Überblick</Text>
          <Text style={s.lead}>
            Punkte von 0 bis 100 je Bereich, aus{" "}
            {r.checks.filter((c) => c.status !== "info").length} Messungen.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {cats.map((c) => (
              <View
                key={c.key}
                style={{ width: "48%", marginBottom: 12 }}
                wrap={false}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 700 }}>
                    {c.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: tone(sc[c.key]),
                    }}
                  >
                    {sc[c.key]}
                  </Text>
                </View>
                <Bar value={sc[c.key]} color={tone(sc[c.key])} />
                {ins.categories[c.key] ? (
                  <Text style={{ fontSize: 8, color: C.soft, marginTop: 4, lineHeight: 1.4 }}>
                    {ins.categories[c.key]}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: "auto",
              backgroundColor: C.paper,
              borderRadius: 10,
              padding: 14,
            }}
            wrap={false}
          >
            <Text style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 6 }}>
              Inhalt
            </Text>
            {contents.map(([t, p]) => (
              <View
                key={t}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 2.5,
                  borderBottomWidth: 0.5,
                  borderBottomColor: C.line,
                }}
              >
                <Text style={{ fontSize: 9 }}>{t}</Text>
                <Text style={{ fontSize: 9, color: C.soft }}>Seite {p}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 8, color: C.soft, marginTop: 8 }}>
              Online-Bericht mit allen Details:{" "}
              <Link src={url} style={{ color: C.teal }}>
                Bericht im Browser öffnen
              </Link>{" "}
              (90 Tage gültig)
            </Text>
          </View>
      </Page>

      {/* 2 · recommendations */}
      <Page size="A4" style={s.page}>
        <Footer />
        <Header title="Die wichtigsten Verbesserungen" domain={r.domain} />
          <Text style={s.h1}>Das bringt am meisten</Text>
          <Text style={[s.lead, { marginTop: 4 }]}>
            Die {ins.top.length} wirksamsten Verbesserungen für Ihre Website,
            nach Wirkung sortiert.
          </Text>
          {ins.top.map((t, i) => {
            const [bg, fg] = IMPACT[t.impact];
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                }}
                wrap={false}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: C.petrol,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: 700 }}>
                      {t.title}
                    </Text>
                    <Text style={[s.pill, { backgroundColor: bg, color: fg }]}>
                      Wirkung {t.impact}
                    </Text>
                  </View>
                  <Text style={{ marginBottom: 7, lineHeight: 1.45 }}>{t.problem}</Text>
                  {t.solution ? (
                    <View
                      style={{
                        backgroundColor: "#eef7f6",
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <Text>
                        <Text style={{ fontWeight: 700, color: "#01716b" }}>
                          So lösen Sie es:{" "}
                        </Text>
                        {t.solution}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          {ins.strengths.length > 0 && (
            <View style={{ marginTop: 10 }} wrap={false}>
              <Text
                style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}
              >
                Das machen Sie bereits gut
              </Text>
              {ins.strengths.map((x) => (
                <View
                  key={x}
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <StatusDot status="ok" />
                  <Text>{x}</Text>
                </View>
              ))}
            </View>
          )}
      </Page>

      {/* 3 · Google measurement */}
      {hasGoogle && (
        <Page size="A4" style={s.page}>
          <Footer />
          <Header title="Messung von Google" domain={r.domain} />
            <Text style={s.h1}>Gemessen mit Google PageSpeed</Text>
            <Text style={[s.lead, { marginTop: 4 }]}>
              So sieht Google Ihre Website beim Laden – auf dem Smartphone und
              am Computer.
            </Text>
            {(["mobile", "desktop"] as const).map((w) =>
              lh?.[w] ? (
                <DeviceBlock key={w} which={w} data={lh[w]!} shot={shots[w]} />
              ) : null,
            )}
        </Page>
      )}

      {/* 4 · all checks */}
      <Page size="A4" style={s.page}>
        <Footer />
        <Header title="Alle Prüfpunkte" domain={r.domain} />
          <Text style={s.h1}>Alle Prüfpunkte</Text>
          <Text style={[s.lead, { marginTop: 4 }]}>
            Jede Messung mit Ergebnis und kurzer Erklärung, nach Bereichen
            geordnet.
          </Text>
          {cats.map((c) => {
            const list = r.checks
              .filter((x) => x.category === c.key)
              .sort((a, b) => order(a) - order(b));
            return (
              <View key={c.key} style={{ marginBottom: 14 }}>
                {/* the heading never stays alone at the bottom of a page: it travels with the first check */}
                <View wrap={false}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: C.paper,
                      borderRadius: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      marginBottom: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 700 }}>
                      {c.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: tone(sc[c.key]),
                      }}
                    >
                      {sc[c.key]} Punkte
                    </Text>
                  </View>
                  {list.slice(0, 1).map((x) => (
                    <CheckRow key={x.id} x={x} />
                  ))}
                </View>
                {list.slice(1).map((x) => (
                  <CheckRow key={x.id} x={x} />
                ))}
              </View>
            );
          })}

          <View style={{ marginTop: 6 }} wrap={false}>
            <View
              style={{
                backgroundColor: C.petrol,
                borderRadius: 12,
                padding: 18,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 6,
                }}
              >
                {closingText(r.madex).title}
              </Text>
              <Text style={{ color: "#d9ecea", marginBottom: 10, lineHeight: 1.45 }}>
                {closingText(r.madex).text}
              </Text>
              <Text style={{ color: "#fff", fontWeight: 700 }}>
                {site.contact.phonePrimary.label} · {site.contact.email} ·{" "}
                {site.url.replace(/^https?:\/\//, "")}
              </Text>
            </View>
            <Text style={{ fontSize: 7.5, color: C.mute, marginTop: 10, lineHeight: 1.4 }}>
              Automatische Analyse der Startseite {r.url} vom {date}. Messwerte
              können je nach Server und Tageszeit schwanken.
              {ins.ai
                ? " Die Texte wurden mit KI aus den Messwerten erstellt."
                : ""}
            </Text>
          </View>
      </Page>
    </Document>
  );
}

function CheckRow({ x }: { x: Check }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: C.line,
      }}
      wrap={false}
    >
      <View style={{ paddingTop: 1 }}>
        <StatusDot status={x.status} />
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text style={{ fontWeight: 500, flex: 1 }}>{x.label}</Text>
          {x.value ? (
            <Text
              style={{ color: C.soft, maxWidth: "45%", textAlign: "right" }}
            >
              {x.value}
            </Text>
          ) : null}
        </View>
        {x.detail ? (
          <Text style={{ fontSize: 8.5, color: C.soft, marginTop: 1, lineHeight: 1.4 }}>
            {x.detail}
          </Text>
        ) : null}
        {x.fix && x.status !== "ok" ? (
          <Text style={{ fontSize: 8.5, color: "#01716b", marginTop: 2 }}>
            <Text style={{ fontWeight: 700 }}>Lösung: </Text>
            {x.fix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const VITALS: {
  key: "lcp" | "fcp" | "tbt" | "si" | "cls";
  label: string;
  good: number;
  ok: number;
  fmt: (v: number) => string;
}[] = [
  {
    key: "lcp",
    label: "Hauptinhalt sichtbar",
    good: 2500,
    ok: 4000,
    fmt: (v) =>
      `${(v / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} s`,
  },
  {
    key: "fcp",
    label: "Erster Inhalt sichtbar",
    good: 1800,
    ok: 3000,
    fmt: (v) =>
      `${(v / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} s`,
  },
  {
    key: "si",
    label: "Seite aufgebaut",
    good: 3400,
    ok: 5800,
    fmt: (v) =>
      `${(v / 1000).toLocaleString("de-CH", { maximumFractionDigits: 1 })} s`,
  },
  {
    key: "tbt",
    label: "Blockierte Zeit",
    good: 200,
    ok: 600,
    fmt: (v) => `${v.toLocaleString("de-CH")} ms`,
  },
  {
    key: "cls",
    label: "Layout-Verschiebung",
    good: 0.1,
    ok: 0.25,
    fmt: (v) => v.toLocaleString("de-CH"),
  },
];

function DeviceBlock({
  which,
  data,
  shot,
}: {
  which: "mobile" | "desktop";
  data: Lighthouse;
  shot?: string;
}) {
  const mobile = which === "mobile";
  const scores = [
    ["Leistung", data.performance],
    ["SEO", data.seo],
    ["Barrierefreiheit", data.accessibility],
    ["Best Practices", data.bestPractices],
  ] as const;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 18,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      }}
      wrap={false}
    >
      <View style={{ width: mobile ? 120 : 210, alignItems: "center" }}>
        {shot ? (
          <View
            style={{
              backgroundColor: "#0b0d0e",
              padding: mobile ? 5 : 6,
              borderRadius: mobile ? 16 : 7,
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF image, no alt attribute */}
            <Image
              src={shot}
              style={{
                width: mobile ? 110 : 198,
                borderRadius: mobile ? 12 : 3,
                objectFit: "cover",
                maxHeight: mobile ? 228 : 140,
              }}
            />
          </View>
        ) : (
          <Text style={{ color: C.soft, fontSize: 8 }}>
            Kein Bildschirmfoto
          </Text>
        )}
        {!mobile && shot ? (
          <View
            style={{
              width: 236,
              height: 6,
              backgroundColor: "#c9ced1",
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          {mobile ? "Smartphone" : "Desktop"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
          {scores.map(([l, v]) => (
            <View
              key={l}
              style={{
                flex: 1,
                borderRadius: 6,
                padding: 6,
                backgroundColor:
                  v >= 85
                    ? "#e8f4ee"
                    : v >= 60
                      ? "#e6f2f1"
                      : v >= 40
                        ? "#f7efdf"
                        : "#f9e7e5",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: 700, color: tone(v) }}>
                {v}
              </Text>
              <Text style={{ fontSize: 7, color: C.soft }}>{l}</Text>
            </View>
          ))}
        </View>
        {VITALS.map((v) => {
          const val = data.vitals[v.key];
          if (val === undefined) return null;
          const col = val <= v.good ? C.good : val <= v.ok ? C.weak : C.poor;
          return (
            <View
              key={v.key}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 3,
                borderBottomWidth: 0.5,
                borderBottomColor: C.line,
              }}
            >
              <Text>{v.label}</Text>
              <Text style={{ fontWeight: 700, color: col }}>{v.fmt(val)}</Text>
            </View>
          );
        })}
        {data.opportunities.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>
              Grösste Einsparungen laut Google
            </Text>
            {data.opportunities.slice(0, 3).map((o) => (
              <View
                key={o.title}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ flex: 1, fontSize: 8.5 }}>{o.title}</Text>
                {o.savingsMs ? (
                  <Text
                    style={{ fontSize: 8.5, color: C.poor, fontWeight: 700 }}
                  >
                    −
                    {(o.savingsMs / 1000).toLocaleString("de-CH", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    s
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export async function renderReportPdf(
  r: Report,
  shots: { mobile?: string; desktop?: string },
  url: string,
): Promise<Buffer> {
  registerFonts();
  const logo = readFileSync(
    path.join(process.cwd(), "public", "brand", "logo.png"),
  );
  return renderToBuffer(
    <ReportPdf r={r} shots={shots} logo={logo} url={url} />,
  );
}
