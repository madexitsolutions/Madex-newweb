"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { site } from "@/content/site";
import { Link, useTransition } from "./Transition";

export type OrionConfig = {
  enabled: boolean;
  name: string;
  welcome: string;
  teaserEnabled: boolean;
  teaserMessage: string;
  teaserDelay: number;
  teaserMobile: boolean;
};

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };
type View = "start" | "chat" | "finder" | "form" | "done";
type Stored = { id: string; token: string; title: string; updatedAt: string };

const SECTIONS: Record<string, { label: string; url: string }> = {
  pakete: { label: "Pakete ansehen", url: "/#pakete" },
  angebot: { label: "Website inklusive", url: "/#angebot" },
  ki: { label: "KI-Assistent für Ihre Website", url: "/marketing-solutions/ki-integration" },
  analyse: { label: "Kostenlose Analyse", url: "/kostenlose-prufung" },
  kontakt: { label: "Kontaktseite", url: "/kontakt" },
  portfolio: { label: "Referenzen ansehen", url: "/website-portfolio" },
  webdesign: { label: "Webdesign", url: "/marketing-solutions/website-development" },
  seo: { label: "SEO-Optimierung", url: "/marketing-solutions/seo-optimierung" },
  "google-ads": { label: "Google Marketing", url: "/marketing-solutions/google-marketing" },
  "social-media": { label: "Social Media Marketing", url: "/marketing-solutions/social-media-marketing" },
};

const GOALS: [string, string][] = [
  ["website", "Neue Website / Webdesign"],
  ["wartung", "Website-Betreuung & Hosting"],
  ["seo", "Bei Google gefunden werden"],
  ["google-ads", "Google Ads"],
  ["social-media", "Social Media Marketing"],
  ["foto-video", "Fotos & Werbevideos"],
  ["grafik", "Grafikdesign & Logo"],
];

const SERVICES: [string, string][] = [
  ["website", "Neue Website / Webdesign"],
  ["wartung", "Website-Betreuung & Hosting"],
  ["seo", "SEO – besser gefunden werden"],
  ["google-ads", "Google Ads"],
  ["social-media", "Social Media Marketing"],
  ["foto-video", "Fotos & Werbevideos"],
  ["grafik", "Grafikdesign & Logo"],
  ["ki", "KI-Assistent für meine Website"],
  ["analyse", "Kostenlose Website-Analyse"],
  ["other", "Anderes Anliegen"],
];

const SIZES: [number, string][] = [
  [1, "Nur ich (Einzelunternehmen)"],
  [5, "2–10 Mitarbeitende"],
  [20, "11–50 Mitarbeitende"],
  [60, "Mehr als 50 Mitarbeitende"],
];

const TIMES: [string, string][] = [
  ["morning", "Vormittag (08:00–12:00)"],
  ["midday", "Mittag (12:00–14:00)"],
  ["afternoon", "Nachmittag (14:00–18:00)"],
  ["flexible", "Flexibel"],
];

const STORE_KEY = "madex-orion-chats";
const CURRENT_KEY = "madex-orion-current";

function loadStored(): Stored[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]") as Stored[];
  } catch {
    return [];
  }
}
function saveStored(list: Stored[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {}
}

/** Renders assistant text: [label](url) and [[seite:key]] become buttons. */
function RichText({ text, onNavigate }: { text: string; onNavigate: (href: string) => void }) {
  const buttons: { label: string; href: string }[] = [];
  const cleaned = text
    .replace(/\[\[seite:([a-z0-9-]+)\]\]/g, (_, k: string) => {
      const s = SECTIONS[k];
      if (s && !buttons.some((b) => b.href === s.url)) buttons.push({ label: s.label, href: s.url });
      return "";
    })
    .replace(/\[([^\]]{1,80})\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const href = url.replace(/^https?:\/\/(www\.)?madex-it\.ch/, "") || "/";
      if (!buttons.some((b) => b.href === href)) buttons.push({ label, href });
      return label;
    })
    .trim();
  return (
    <>
      {cleaned.split(/\n+/).map((p, i) =>
        p.startsWith("- ") ? (
          <p key={i} className="or-li">
            {p.slice(2)}
          </p>
        ) : (
          <p key={i}>{p}</p>
        ),
      )}
      {buttons.length > 0 && (
        <div className="or-links">
          {buttons.map((b) => (
            <button key={b.href} onClick={() => onNavigate(b.href)}>
              {b.label}
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17 17 7m-8 0h8v8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Loads the admin-managed config, then renders the widget. */
export function Orion() {
  const [config, setConfig] = useState<OrionConfig | null>(null);
  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((j: { chat: OrionConfig }) => setConfig(j.chat))
      .catch(() => {});
  }, []);
  if (!config) return null;
  return <OrionWidget config={config} />;
}

function OrionWidget({ config }: { config: OrionConfig }) {
  const { navigate } = useTransition();
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [view, setView] = useState<View>("start");
  const [session, setSession] = useState<{ id: string; token: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState("");
  const [history, setHistory] = useState<Stored[]>([]);
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [formType, setFormType] = useState<"termin" | "analyse" | "support">("termin");
  const [prefill, setPrefill] = useState<{ service?: string; pkg?: string }>({});
  const [reference, setReference] = useState("");
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadStored());
    try {
      const cur = JSON.parse(localStorage.getItem(CURRENT_KEY) || "null") as { id: string; token: string } | null;
      if (cur) setSession(cur);
    } catch {}
  }, []);

  // proactive greeting bubble, once per visit
  useEffect(() => {
    if (!config.enabled || !config.teaserEnabled) return;
    if (!config.teaserMobile && window.matchMedia("(max-width: 640px)").matches) return;
    try {
      if (sessionStorage.getItem("madex-orion-teaser")) return;
    } catch {}
    const t = setTimeout(() => {
      setTeaser(true);
      try {
        sessionStorage.setItem("madex-orion-teaser", "1");
      } catch {}
    }, Math.max(1, config.teaserDelay) * 1000);
    return () => clearTimeout(t);
  }, [config]);

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onOpen = () => {
      setTeaser(false);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("orion:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("orion:open", onOpen);
    };
  }, []);

  const ensureSession = useCallback(async () => {
    if (session) return session;
    const res = await fetch("/api/chat/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: location.pathname }) });
    const json = (await res.json()) as { ok: boolean; id?: string; token?: string; welcome?: string; error?: string };
    if (!json.ok || !json.id || !json.token) throw new Error(json.error || "Die Chat-Sitzung konnte nicht gestartet werden.");
    const s = { id: json.id, token: json.token };
    setSession(s);
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
    } catch {}
    setMsgs([{ role: "assistant", content: json.welcome || config.welcome }]);
    return s;
  }, [session, config.welcome]);

  const remember = useCallback((s: { id: string; token: string }, title: string) => {
    const list = [{ ...s, title: title.slice(0, 60), updatedAt: new Date().toISOString() }, ...loadStored().filter((x) => x.id !== s.id)];
    saveStored(list);
    setHistory(list);
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBanner("");
    setView("chat");
    setInput("");
    setBusy(true);
    try {
      const s = await ensureSession();
      setMsgs((m) => [...(m.length ? m : [{ role: "assistant" as const, content: config.welcome }]), { role: "user", content: message }]);
      const res = await fetch("/api/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, message }) });
      const json = (await res.json()) as { ok: boolean; reply?: string; actions?: string[]; error?: string };
      if (!json.ok) {
        setBanner(json.error || "Die Nachricht konnte nicht gesendet werden.");
        if (res.status === 401) {
          setSession(null);
          try {
            localStorage.removeItem(CURRENT_KEY);
          } catch {}
        }
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: json.reply!, actions: json.actions }]);
        remember(s, msgs.find((x) => x.role === "user")?.content || message);
      }
    } catch (e) {
      setBanner((e as Error).message || "Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  };

  const resume = async (s: Stored) => {
    setBanner("");
    const res = await fetch(`/api/chat/session?id=${encodeURIComponent(s.id)}&token=${encodeURIComponent(s.token)}`);
    const json = (await res.json()) as { ok: boolean; messages?: Msg[]; error?: string };
    if (!json.ok) {
      setBanner(json.error || "Der Chatverlauf konnte nicht geladen werden.");
      const list = loadStored().filter((x) => x.id !== s.id);
      saveStored(list);
      setHistory(list);
      return;
    }
    setSession({ id: s.id, token: s.token });
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify({ id: s.id, token: s.token }));
    } catch {}
    setMsgs(json.messages ?? []);
    setView("chat");
  };

  const fresh = () => {
    setSession(null);
    setMsgs([]);
    setBanner("");
    try {
      localStorage.removeItem(CURRENT_KEY);
    } catch {}
    setView("start");
  };

  const startForm = (type: "termin" | "analyse" | "support", pre: { service?: string; pkg?: string } = {}) => {
    setFormType(type);
    setPrefill(pre);
    setBanner("");
    setView("form");
  };

  const runAction = (a: string) => {
    if (a === "pakete") setView("finder");
    else if (a === "termin") startForm("termin");
    else if (a === "analyse") startForm("analyse", { service: "analyse" });
  };

  const go = (href: string) => {
    if (href.startsWith("http") && !href.includes("madex-it.ch")) {
      window.open(href, "_blank", "noopener");
      return;
    }
    if (window.matchMedia("(max-width: 640px)").matches) setOpen(false);
    navigate(href);
  };

  if (!config.enabled) return null;

  const back = view !== "start" ? () => setView(view === "form" && msgs.length ? "chat" : view === "done" ? "start" : view === "chat" ? "start" : msgs.length ? "chat" : "start") : null;

  return (
    <div className="or">
      <AnimatePresence>
        {open && (
          <motion.section
            className="or-panel"
            role="dialog"
            aria-label={`${config.name} – KI-Assistent von Madex IT Solutions`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="or-head">
              {back ? (
                <button className="or-icon-btn" onClick={back} aria-label="Zurück">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <span className="or-avatar" aria-hidden="true">
                  <Sparkle />
                </span>
              )}
              <div className="or-title">
                <strong>{config.name}</strong>
                <small>
                  <span className="or-dot" /> KI-Assistent von Madex IT Solutions
                </small>
              </div>
              <button className="or-icon-btn" onClick={() => setOpen(false)} aria-label="Chat schliessen">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            {banner && (
              <div className="or-banner" role="alert">
                {banner}
              </div>
            )}

            <div className="or-body" ref={body} data-lenis-prevent>
              {view === "start" && (
                <Start
                  name={config.name}
                  history={history}
                  hasCurrent={Boolean(session && msgs.length)}
                  isClient={isClient}
                  setIsClient={setIsClient}
                  onAsk={() => setView("chat")}
                  onTermin={() => startForm("termin")}
                  onFinder={() => setView("finder")}
                  onSupport={() => startForm("support")}
                  onResume={resume}
                  onContinue={() => setView("chat")}
                  onNew={fresh}
                />
              )}
              {view === "chat" && (
                <div className="or-thread" aria-live="polite">
                  {(msgs.length ? msgs : [{ role: "assistant" as const, content: config.welcome }]).map((m, i) => (
                    <div key={i} className={`or-msg or-msg--${m.role}`}>
                      {m.role === "assistant" && (
                        <span className="or-mini" aria-hidden="true">
                          <Sparkle />
                        </span>
                      )}
                      <div className="or-bubble">
                        {m.role === "assistant" ? <RichText text={m.content} onNavigate={go} /> : <p>{m.content}</p>}
                        {m.actions?.includes("kontakt") && <ContactButtons />}
                        {m.actions && m.actions.filter((a) => a !== "kontakt").length > 0 && (
                          <div className="or-next" aria-label="Vorgeschlagene nächste Schritte">
                            {m.actions.includes("pakete") && <button onClick={() => runAction("pakete")}>Passendes Paket finden</button>}
                            {m.actions.includes("analyse") && <button onClick={() => runAction("analyse")}>Kostenlose Analyse anfragen</button>}
                            {m.actions.includes("termin") && <button onClick={() => runAction("termin")}>Beratungstermin anfragen</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="or-msg or-msg--assistant">
                      <span className="or-mini" aria-hidden="true">
                        <Sparkle />
                      </span>
                      <div className="or-bubble or-typing" aria-label={`${config.name} schreibt`}>
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {view === "finder" && <Finder onRequest={(pkg) => startForm("termin", { pkg })} onAsk={() => setView("chat")} />}
              {view === "form" && (
                <AppointmentForm
                  type={formType}
                  prefill={prefill}
                  ensureSession={ensureSession}
                  existingClient={isClient}
                  onDone={(ref) => {
                    setReference(ref);
                    setView("done");
                  }}
                />
              )}
              {view === "done" && (
                <div className="or-done">
                  <span className="or-check" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24">
                      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h3>Anfrage gesendet</h3>
                  <p>{formType === "termin" ? "Vielen Dank. Das Madex-Team bestätigt Ihren Wunschtermin persönlich." : "Vielen Dank. Wir melden uns in der Regel innerhalb von 24 Stunden."}</p>
                  <div className="or-ref">
                    <small>Referenznummer</small>
                    <strong>{reference}</strong>
                  </div>
                  <p className="or-muted">Mit dieser Nummer kann Ihnen {config.name} jederzeit den Stand Ihrer Anfrage nennen.</p>
                  <button className="or-btn or-btn--ghost" onClick={() => setView(msgs.length ? "chat" : "start")}>
                    Zurück zum Chat
                  </button>
                </div>
              )}
            </div>

            {(view === "chat" || view === "start") && (
              <form
                className="or-composer"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <label className="sr-only" htmlFor="or-input">
                  Frage an den Assistenten
                </label>
                <textarea
                  id="or-input"
                  rows={1}
                  value={input}
                  maxLength={1000}
                  placeholder="Schreiben Sie Ihre Frage …"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <button type="submit" className="or-send" disabled={!input.trim() || busy} aria-label="Nachricht senden">
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            )}
            <p className="or-legal">
              Ihre Nachrichten werden zur Bearbeitung Ihrer Anfrage gespeichert. <Link href="/datenschutz">Datenschutz</Link>
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {teaser && !open && (
          <motion.div className="or-teaser" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <button
              className="or-teaser-text"
              onClick={() => {
                setTeaser(false);
                setOpen(true);
              }}
            >
              {config.teaserMessage}
            </button>
            <button className="or-teaser-x" onClick={() => setTeaser(false)} aria-label="Hinweis schliessen">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        className="or-launcher"
        onClick={() => {
          setOpen(!open);
          setTeaser(false);
        }}
        aria-expanded={open}
        aria-label={open ? "Chat schliessen" : teaser ? "Madex Chat öffnen – 1 neue Nachricht" : "Madex Chat öffnen"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="#fff" />
          </svg>
        )}
        {teaser && !open && <span className="or-badge">1</span>}
      </button>

      <style>{`
        .or{position:fixed;right:20px;bottom:20px;z-index:700;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-family:var(--font-body)}
        .or *{box-sizing:border-box}
        .or-launcher{position:relative;width:60px;height:60px;border-radius:50%;background:#028d86;display:grid;place-items:center;transition:background .2s}
        .or-launcher:hover{background:#017a74}
        .or-badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;background:#d93025;color:#fff;font:600 12px/20px var(--font-body);text-align:center;border:2px solid #fff}
        .or-teaser{display:flex;align-items:flex-start;gap:4px;max-width:300px;background:#fff;color:var(--ink);border:1px solid var(--line-soft);border-radius:14px 14px 4px 14px;box-shadow:0 12px 32px -18px rgba(1,54,59,.5)}
        .or-teaser-text{padding:12px 4px 12px 14px;text-align:left;font-size:14px;line-height:1.45}
        .or-teaser-x{padding:6px 10px;font-size:18px;color:var(--ink-soft)}
        .or-panel{width:min(412px,calc(100vw - 24px));height:min(700px,calc(100dvh - 110px));display:flex;flex-direction:column;background:#fcfcfc;color:var(--ink);border:1px solid var(--line-soft);border-radius:16px;overflow:hidden;box-shadow:0 30px 70px -30px rgba(1,54,59,.55);transform-origin:bottom right}
        .or-head{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;background:#fff;border-bottom:1px solid var(--line-soft)}
        .or-avatar{width:36px;height:36px;border-radius:10px;background:#e3f3f1;color:#028d86;display:grid;place-items:center;flex:none}
        .or-title{flex:1;min-width:0}
        .or-title strong{display:block;font-size:16px;font-weight:700}
        .or-title small{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-soft)}
        .or-dot{width:7px;height:7px;border-radius:50%;background:#1a9f5c}
        .or-icon-btn{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;color:var(--ink-soft);flex:none}
        .or-icon-btn:hover{background:#f0f3f3;color:var(--ink)}
        .or-banner{padding:10px 16px;background:#fdecea;color:#8a1c14;font-size:13.5px;border-bottom:1px solid #f6cfca}
        .or-body{flex:1;overflow-y:auto;padding:16px;overscroll-behavior:contain}
        .or-thread{display:grid;gap:12px}
        .or-msg{display:flex;gap:8px;align-items:flex-end;max-width:100%}
        .or-msg--user{justify-content:flex-end}
        .or-mini{width:24px;height:24px;border-radius:7px;background:#e3f3f1;color:#028d86;display:grid;place-items:center;flex:none}
        .or-mini svg{width:14px;height:14px}
        .or-bubble{max-width:86%;padding:10px 13px;border-radius:12px;font-size:14.5px;line-height:1.5;background:#fff;border:1px solid var(--line-soft)}
        .or-msg--user .or-bubble{background:#028d86;border-color:#028d86;color:#fff;border-bottom-right-radius:4px}
        .or-msg--assistant .or-bubble{border-bottom-left-radius:4px}
        .or-bubble p{margin:0 0 6px}
        .or-bubble p:last-child{margin-bottom:0}
        .or-li{padding-left:14px;position:relative}
        .or-li::before{content:"";position:absolute;left:2px;top:.62em;width:5px;height:5px;border-radius:50%;background:#028d86}
        .or-links,.or-next{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
        .or-links button,.or-next button{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:8px;font-size:13px;font-weight:500;border:1px solid #bfe3df;color:#025159;background:#f2faf9}
        .or-links button:hover,.or-next button:hover{background:#028d86;border-color:#028d86;color:#fff}
        .or-typing{display:flex;gap:4px;padding:14px}
        .or-typing span{width:6px;height:6px;border-radius:50%;background:#028d86;animation:orDot 1s infinite alternate}
        .or-typing span:nth-child(2){animation-delay:.2s}.or-typing span:nth-child(3){animation-delay:.4s}
        @keyframes orDot{to{opacity:.25;transform:translateY(-3px)}}
        .or-contact{display:grid;gap:6px;margin-top:10px}
        .or-contact a{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:8px;background:#f2faf9;border:1px solid #bfe3df;color:#025159;font-size:13.5px;font-weight:500}
        .or-contact a:hover{background:#028d86;color:#fff;border-color:#028d86}
        .or-composer{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid var(--line-soft)}
        .or-composer textarea{flex:1;resize:none;max-height:110px;font:16px/1.4 var(--font-body);padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}
        .or-composer textarea:focus{outline:none;border-color:#028d86}
        .or-send{width:42px;height:42px;border-radius:10px;background:#028d86;color:#fff;display:grid;place-items:center;flex:none}
        .or-send:disabled{opacity:.4}
        .or-legal{margin:0;padding:0 14px 10px;background:#fff;font-size:11.5px;color:var(--ink-soft)}
        .or-legal a{text-decoration:underline}
        .or-h{font-size:20px;font-weight:700;letter-spacing:-.01em;margin:4px 0 6px}
        .or-muted{color:var(--ink-soft);font-size:13.5px;margin:0 0 14px}
        .or-actions{display:grid;gap:8px;margin:16px 0}
        .or-action{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line-soft);border-radius:12px;background:#fff;text-align:left;font-size:14.5px;font-weight:500}
        .or-action:hover{border-color:#028d86}
        .or-action small{display:block;font-weight:400;color:var(--ink-soft);font-size:12.5px}
        .or-action i{width:34px;height:34px;border-radius:9px;background:#e3f3f1;color:#028d86;display:grid;place-items:center;flex:none;font-style:normal}
        .or-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 4px}
        .or-seg button{padding:10px;border-radius:10px;border:1px solid var(--line);font-size:13.5px;background:#fff}
        .or-seg button[aria-pressed="true"]{background:#025159;border-color:#025159;color:#fff}
        .or-hist{margin-top:18px}
        .or-hist h4{font-size:13px;font-weight:600;color:var(--ink-soft);margin:0 0 8px}
        .or-hist button{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--line-soft);background:#fff;margin-bottom:6px;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .or-hist button small{display:block;color:var(--ink-soft);font-size:12px}
        .or-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;border-radius:10px;background:#028d86;color:#fff;font-weight:600;font-size:14.5px}
        .or-btn:hover{background:#017a74}
        .or-btn:disabled{opacity:.6}
        .or-btn--ghost{background:#fff;color:#025159;border:1px solid var(--line)}
        .or-btn--ghost:hover{background:#f2faf9}
        .or-field{display:grid;gap:5px;margin-bottom:12px}
        .or-field label,.or-field legend{font-size:13px;font-weight:600}
        .or-field input,.or-field select,.or-field textarea{font:16px/1.4 var(--font-body);padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);width:100%}
        .or-field input:focus,.or-field select:focus,.or-field textarea:focus{outline:none;border-color:#028d86}
        .or-chips{display:flex;flex-wrap:wrap;gap:6px}
        .or-chips button{padding:8px 11px;border-radius:999px;border:1px solid var(--line);font-size:13px;background:#fff}
        .or-chips button[aria-pressed="true"]{background:#025159;border-color:#025159;color:#fff}
        .or-steps{display:flex;gap:6px;margin-bottom:14px}
        .or-steps span{flex:1;height:3px;border-radius:2px;background:#e1e8e7}
        .or-steps span.on{background:#028d86}
        .or-consent{display:flex;gap:10px;font-size:13px;align-items:flex-start;margin:6px 0 12px}
        .or-consent input{margin-top:3px;accent-color:#028d86;width:16px;height:16px}
        .or-review{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:12px}
        .or-review td{padding:7px 0;border-bottom:1px solid var(--line-soft);vertical-align:top}
        .or-review td:first-child{color:var(--ink-soft);width:40%;padding-right:10px}
        .or-pkg{border:1px solid var(--line-soft);border-radius:12px;background:#fff;padding:14px;margin-bottom:10px}
        .or-pkg.is-best{border-color:#028d86;box-shadow:0 0 0 1px #028d86}
        .or-pkg h4{margin:0 0 4px;font-size:16px}
        .or-pkg p{margin:0 0 8px;font-size:13.5px;color:var(--ink-soft)}
        .or-pkg ul{margin:0 0 10px;padding-left:18px;font-size:13.5px}
        .or-tag{display:inline-block;font-size:11.5px;font-weight:600;color:#025159;background:#e3f3f1;border-radius:6px;padding:3px 7px;margin-bottom:6px}
        .or-done{text-align:center;padding:20px 6px}
        .or-check{width:60px;height:60px;border-radius:50%;background:#028d86;color:#fff;display:grid;place-items:center;margin:0 auto 12px}
        .or-done h3{margin:0 0 6px;font-size:19px}
        .or-ref{display:inline-grid;gap:2px;padding:10px 16px;border:1px dashed #028d86;border-radius:10px;margin:12px 0}
        .or-ref small{font-size:12px;color:var(--ink-soft)}
        .or-ref strong{font-size:17px;letter-spacing:.04em;font-variant-numeric:tabular-nums}
        @media(max-width:640px){.or{right:12px;bottom:12px}.or-panel{width:calc(100vw - 24px);height:calc(100dvh - 96px)}}
      `}</style>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" />
    </svg>
  );
}

function ContactButtons() {
  return (
    <div className="or-contact">
      <span style={{ fontSize: 13 }}>Unser Team hilft Ihnen gerne persönlich weiter:</span>
      <a href={site.contact.phonePrimary.href}>Anrufen: {site.contact.phonePrimary.label}</a>
      <a href={site.contact.phoneSecondary.href}>Anrufen: {site.contact.phoneSecondary.label}</a>
      <a href={`mailto:${site.contact.email}`}>E-Mail schreiben: {site.contact.email}</a>
    </div>
  );
}

function Action({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="or-action" onClick={onClick}>
      <i aria-hidden="true">{icon}</i>
      <span>
        {title}
        <small>{sub}</small>
      </span>
    </button>
  );
}

function Start(props: {
  name: string;
  history: Stored[];
  hasCurrent: boolean;
  isClient: boolean | null;
  setIsClient: (v: boolean) => void;
  onAsk: () => void;
  onTermin: () => void;
  onFinder: () => void;
  onSupport: () => void;
  onResume: (s: Stored) => void;
  onContinue: () => void;
  onNew: () => void;
}) {
  return (
    <div>
      <h2 className="or-h">Hallo, ich bin {props.name} 👋</h2>
      <p className="or-muted">Ich beantworte Ihre Fragen zu Website, Google und Social Media, finde das passende Paket für Sie und nehme Ihre Terminanfrage auf – rund um die Uhr.</p>
      <div className="or-seg" role="group" aria-label="Sind Sie bereits Madex-Kunde?">
        <button aria-pressed={props.isClient === false} onClick={() => props.setIsClient(false)}>
          Ich bin noch nicht Kunde
        </button>
        <button
          aria-pressed={props.isClient === true}
          onClick={() => {
            props.setIsClient(true);
          }}
        >
          Ich bin bereits Kunde
        </button>
      </div>
      <div className="or-actions">
        {props.isClient === true ? (
          <>
            <Action icon="?" title="Support oder Rückruf" sub="Änderungen, Fragen zu Ihrer Website, Rechnung" onClick={props.onSupport} />
            <Action icon="✎" title="Frage stellen" sub={`${props.name} antwortet sofort`} onClick={props.onAsk} />
          </>
        ) : (
          <>
            <Action icon="✎" title="Frage stellen" sub={`${props.name} antwortet sofort`} onClick={props.onAsk} />
            <Action icon="◷" title="Termin anfragen" sub="Kostenloses Erstgespräch – wir bestätigen persönlich" onClick={props.onTermin} />
            <Action icon="✓" title="Passendes Paket finden" sub="Drei kurze Fragen, dann unsere Empfehlung" onClick={props.onFinder} />
          </>
        )}
      </div>
      {(props.hasCurrent || props.history.length > 0) && (
        <div className="or-hist">
          <h4>Ihre bisherigen Gespräche</h4>
          {props.hasCurrent && (
            <button onClick={props.onContinue}>
              Aktuelles Gespräch fortsetzen
              <small>Zuletzt geöffnet</small>
            </button>
          )}
          {props.history.slice(0, 4).map((h) => (
            <button key={h.id} onClick={() => props.onResume(h)}>
              {h.title}
              <small>{new Date(h.updatedAt).toLocaleDateString("de-CH")}</small>
            </button>
          ))}
          <button onClick={props.onNew}>+ Neues Gespräch beginnen</button>
        </div>
      )}
    </div>
  );
}

type Rec = { id: string; name: string; shortDescription: string; audience: string; features: string[]; match: { matched: string[]; missing: string[] } };

function Finder({ onRequest, onAsk }: { onRequest: (pkg: string) => void; onAsk: () => void }) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const next = async () => {
    setError("");
    if (step === 0 && !goals.length) return setError("Bitte wählen Sie mindestens ein Ziel aus.");
    if (step === 1 && hasWebsite === null) return setError("Bitte geben Sie an, ob Sie bereits eine Website haben.");
    if (step < 2) return setStep(step + 1);
    if (size === null) return setError("Bitte wählen Sie die Grösse Ihres Unternehmens.");
    setLoading(true);
    try {
      const res = await fetch("/api/chat/packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals, hasWebsite, companySize: size }) });
      const json = (await res.json()) as { ok: boolean; packages: Rec[] };
      setRecs(json.packages);
    } catch {
      setError("Pakete konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  if (recs) {
    return (
      <div>
        <h2 className="or-h">Unsere Empfehlung für Sie</h2>
        <p className="or-muted">Basierend auf Ihren Zielen: {goals.map((g) => GOALS.find((x) => x[0] === g)?.[1]).join(", ")}</p>
        {recs.length === 0 && <p>Für diese Auswahl stellen wir Ihnen gerne ein passendes Angebot zusammen.</p>}
        {recs.map((p, i) => (
          <article key={p.id} className={`or-pkg${i === 0 ? " is-best" : ""}`}>
            {i === 0 && <span className="or-tag">Unsere Empfehlung</span>}
            <h4>{p.name}</h4>
            <p>{p.shortDescription}</p>
            {p.match.matched.length > 0 && <p style={{ color: "#025159" }}>Deckt ab: {p.match.matched.join(", ")}</p>}
            {p.match.missing.length > 0 && <p>Nicht enthalten: {p.match.missing.join(", ")}</p>}
            <ul>
              {(expanded === p.id ? p.features : p.features.slice(0, 4)).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {p.features.length > 4 && (
              <button className="or-btn or-btn--ghost" style={{ marginBottom: 8 }} onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                {expanded === p.id ? "Weniger anzeigen" : "Mehr anzeigen"}
              </button>
            )}
            <button className="or-btn" onClick={() => onRequest(p.name)}>
              Beratung zu diesem Paket anfragen
            </button>
          </article>
        ))}
        <p className="or-muted">Unsicher? Das Erstgespräch ist kostenlos und unverbindlich.</p>
        <button className="or-btn or-btn--ghost" onClick={onAsk}>
          Andere Frage stellen
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="or-h">Passendes Paket finden</h2>
      <p className="or-muted">Drei kurze Fragen, dann zeigen wir Ihnen, welches Paket am besten passt und warum.</p>
      <div className="or-steps" aria-hidden="true">
        {[0, 1, 2].map((s) => (
          <span key={s} className={s <= step ? "on" : ""} />
        ))}
      </div>
      {error && (
        <p role="alert" style={{ color: "#b3261e", fontSize: 13.5 }}>
          {error}
        </p>
      )}
      {step === 0 && (
        <fieldset className="or-field" style={{ border: 0, padding: 0 }}>
          <legend>Was möchten Sie erreichen? Mehrere möglich.</legend>
          <div className="or-chips">
            {GOALS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={goals.includes(k)} onClick={() => setGoals((g) => (g.includes(k) ? g.filter((x) => x !== k) : [...g, k]))}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {step === 1 && (
        <fieldset className="or-field" style={{ border: 0, padding: 0 }}>
          <legend>Haben Sie bereits eine Website?</legend>
          <div className="or-seg">
            <button type="button" aria-pressed={hasWebsite === true} onClick={() => setHasWebsite(true)}>
              Ja
            </button>
            <button type="button" aria-pressed={hasWebsite === false} onClick={() => setHasWebsite(false)}>
              Nein, noch nicht
            </button>
          </div>
        </fieldset>
      )}
      {step === 2 && (
        <fieldset className="or-field" style={{ border: 0, padding: 0 }}>
          <legend>Wie gross ist Ihr Unternehmen?</legend>
          <div className="or-chips">
            {SIZES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={size === v} onClick={() => setSize(v)}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <button className="or-btn" onClick={next} disabled={loading}>
          {step < 2 ? "Weiter" : loading ? "Empfehlung wird erstellt …" : "Empfehlung anzeigen"}
        </button>
        {step > 0 && (
          <button className="or-btn or-btn--ghost" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        )}
      </div>
    </div>
  );
}

function AppointmentForm({
  type,
  prefill,
  ensureSession,
  existingClient,
  onDone,
}: {
  type: "termin" | "analyse" | "support";
  prefill: { service?: string; pkg?: string };
  ensureSession: () => Promise<{ id: string; token: string }>;
  existingClient: boolean | null;
  onDone: (ref: string) => void;
}) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [key] = useState(() => `orion-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  const [v, setV] = useState({
    service: prefill.service ?? (type === "support" ? "wartung" : ""),
    pkg: prefill.pkg ?? "",
    message: type === "analyse" ? "Ich interessiere mich für die kostenlose Website- und Marketing-Analyse." : type === "support" ? "" : "",
    date: tomorrow,
    time: "",
    name: "",
    company: "",
    email: "",
    phone: "",
    client: existingClient ?? (type === "support" ? true : null),
    consent: false,
  });
  const set = (k: keyof typeof v, val: unknown) => setV((x) => ({ ...x, [k]: val }));
  const title = type === "termin" ? "Beratungstermin anfragen" : type === "analyse" ? "Kostenlose Website-Analyse" : "Support oder Rückruf";

  const validate = () => {
    if (step === 0 && !v.service) return "Bitte wählen Sie ein Thema aus.";
    if (step === 1 && (!v.date || v.date < new Date().toISOString().slice(0, 10))) return "Bitte wählen Sie ein gültiges Datum in der Zukunft.";
    if (step === 1 && !v.time) return "Bitte wählen Sie ein Zeitfenster.";
    if (step === 2) {
      if (v.name.trim().length < 2) return "Bitte geben Sie Ihren vollständigen Namen ein.";
      if (!/^\S+@\S+\.\S+$/.test(v.email)) return "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
      if (v.client === null) return "Bitte geben Sie an, ob Sie bereits Kunde sind.";
      if (!v.consent) return "Bitte stimmen Sie der Datenverarbeitung zu.";
    }
    return "";
  };

  const next = () => {
    const e = validate();
    setError(e);
    if (!e) setStep(step + 1);
  };

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      const s = await ensureSession();
      const res = await fetch("/api/chat/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...s,
          idempotencyKey: key,
          type,
          name: v.name,
          company: v.company,
          email: v.email,
          phone: v.phone,
          existingClient: v.client,
          service: v.service,
          packageInterest: v.pkg,
          preferredDate: v.date,
          preferredTime: v.time,
          message: v.message,
          consent: v.consent,
        }),
      });
      const json = (await res.json()) as { ok: boolean; reference?: string; error?: string };
      if (!json.ok) setError(json.error || "Die Anfrage konnte nicht gesendet werden. Ihre Eingaben bleiben erhalten.");
      else onDone(json.reference!);
    } catch {
      setError("Die Anfrage konnte nicht gesendet werden. Ihre Eingaben bleiben erhalten.");
    } finally {
      setSending(false);
    }
  };

  const svcLabel = SERVICES.find((s) => s[0] === v.service)?.[1] ?? "–";
  const timeLabel = TIMES.find((t) => t[0] === v.time)?.[1] ?? "–";

  return (
    <div>
      <h2 className="or-h">{title}</h2>
      <p className="or-muted">{["Worum geht es bei Ihrem Anliegen?", "Wann passt es Ihnen?", "Wie dürfen wir Sie erreichen?", "Bitte prüfen Sie Ihre Angaben"][step]}</p>
      <div className="or-steps" aria-hidden="true">
        {[0, 1, 2, 3].map((s) => (
          <span key={s} className={s <= step ? "on" : ""} />
        ))}
      </div>
      {error && (
        <p role="alert" style={{ color: "#b3261e", fontSize: 13.5 }}>
          {error}
        </p>
      )}
      {step === 0 && (
        <>
          <div className="or-field">
            <label htmlFor="or-svc">Thema oder Leistung</label>
            <select id="or-svc" value={v.service} onChange={(e) => set("service", e.target.value)}>
              <option value="">Bitte auswählen</option>
              {SERVICES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="or-field">
            <label htmlFor="or-pkg">Paket (optional)</label>
            <select id="or-pkg" value={v.pkg} onChange={(e) => set("pkg", e.target.value)}>
              <option value="">Nicht angegeben</option>
              {["Website-Wartung", "Basic", "Premium"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="or-field">
            <label htmlFor="or-msg">Nachricht (optional)</label>
            <textarea id="or-msg" rows={3} value={v.message} placeholder="Beschreiben Sie kurz Ihr Anliegen" onChange={(e) => set("message", e.target.value)} maxLength={5000} />
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <div className="or-field">
            <label htmlFor="or-date">Wunschdatum</label>
            <input id="or-date" type="date" min={tomorrow} value={v.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <fieldset className="or-field" style={{ border: 0, padding: 0 }}>
            <legend>Zeitfenster</legend>
            <div className="or-chips">
              {TIMES.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={v.time === k} onClick={() => set("time", k)}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="or-muted">Dies ist eine Anfrage. Madex bestätigt den Termin persönlich.</p>
        </>
      )}
      {step === 2 && (
        <>
          <div className="or-field">
            <label htmlFor="or-name">Vor- und Nachname *</label>
            <input id="or-name" autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="or-field">
            <label htmlFor="or-company">Firma</label>
            <input id="or-company" autoComplete="organization" value={v.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="or-field">
            <label htmlFor="or-email">E-Mail *</label>
            <input id="or-email" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="or-field">
            <label htmlFor="or-phone">Telefon</label>
            <input id="or-phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <fieldset className="or-field" style={{ border: 0, padding: 0 }}>
            <legend>Sind Sie bereits Madex-Kunde? *</legend>
            <div className="or-seg">
              <button type="button" aria-pressed={v.client === true} onClick={() => set("client", true)}>
                Ja
              </button>
              <button type="button" aria-pressed={v.client === false} onClick={() => set("client", false)}>
                Nein
              </button>
            </div>
          </fieldset>
          <label className="or-consent">
            <input type="checkbox" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} />
            <span>
              Ich stimme der Verarbeitung meiner Daten zur Bearbeitung dieser Anfrage zu (<a href="/datenschutz" target="_blank">Datenschutzerklärung</a>). *
            </span>
          </label>
        </>
      )}
      {step === 3 && (
        <table className="or-review">
          <tbody>
            <tr><td>Thema</td><td>{svcLabel}</td></tr>
            {v.pkg && <tr><td>Paket</td><td>{v.pkg}</td></tr>}
            <tr><td>Wunschtermin</td><td>{new Date(v.date).toLocaleDateString("de-CH")}, {timeLabel}</td></tr>
            <tr><td>Name</td><td>{v.name}</td></tr>
            {v.company && <tr><td>Firma</td><td>{v.company}</td></tr>}
            <tr><td>E-Mail</td><td>{v.email}</td></tr>
            {v.phone && <tr><td>Telefon</td><td>{v.phone}</td></tr>}
            <tr><td>Bereits Kunde</td><td>{v.client ? "Ja" : "Nein"}</td></tr>
            {v.message && <tr><td>Nachricht</td><td>{v.message}</td></tr>}
          </tbody>
        </table>
      )}
      {step === 3 && <p className="or-muted">Ihr Wunschtermin ist noch nicht verbindlich. Wir melden uns zur Bestätigung.</p>}
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {step < 3 ? (
          <button className="or-btn" onClick={next}>
            Weiter
          </button>
        ) : (
          <button className="or-btn" onClick={submit} disabled={sending}>
            {sending ? "Wird gesendet …" : "Anfrage senden"}
          </button>
        )}
        {step > 0 && (
          <button className="or-btn or-btn--ghost" onClick={() => setStep(step === 3 ? 2 : step - 1)}>
            {step === 3 ? "Angaben ändern" : "Zurück"}
          </button>
        )}
      </div>
    </div>
  );
}
