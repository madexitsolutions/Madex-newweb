"use client";

import { useEffect } from "react";
import { SERVICE_LABELS } from "@/content/chatbot";

/**
 * Orion – the chat widget of the former WordPress plugin, unchanged:
 * the original markup (below), stylesheet and script (public/chatbot/*)
 * run inside a Shadow DOM. Only the server endpoint is new (/api/chat/ajax).
 */

type Config = { enabled: boolean; name: string; welcome: string; teaserEnabled: boolean; teaserMessage: string; teaserDelay: number; teaserMobile: boolean };

const ASSET_VERSION = "1.5.7-next2";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SPARKLE = (size: number, cls = "madex-sparkle") =>
  `<svg class="${cls}" aria-hidden="true" fill="currentColor" viewBox="0 0 512 512" width="${size}" height="${size}"><path d="M298.138,136.665c-62.065-13.011-110.576-61.522-123.585-123.588C172.955,5.458,166.235,0,158.448,0 s-14.507,5.458-16.104,13.078c-13.01,62.065-61.521,110.575-123.586,123.584c-7.62,1.597-13.079,8.318-13.079,16.104 s5.458,14.507,13.079,16.104c62.064,13.011,110.573,61.521,123.583,123.586c1.597,7.62,8.317,13.079,16.104,13.079 c7.786,0,14.507-5.458,16.104-13.079c13.011-62.065,61.523-110.575,123.588-123.583c7.62-1.597,13.079-8.317,13.079-16.104 C311.215,144.983,305.757,138.262,298.138,136.665z"></path><path d="M270.938,408.484c-29.242-6.129-52.098-28.985-58.229-58.229c-1.597-7.62-8.317-13.079-16.104-13.079 c-7.786,0-14.507,5.457-16.104,13.078c-6.131,29.243-28.988,52.099-58.23,58.229c-7.62,1.597-13.079,8.318-13.079,16.104 c0,7.786,5.458,14.507,13.079,16.104c29.241,6.13,52.098,28.987,58.228,58.23c1.597,7.62,8.317,13.079,16.104,13.079 c7.786,0,14.507-5.457,16.104-13.079c6.131-29.243,28.988-52.099,58.231-58.229c7.62-1.597,13.079-8.318,13.079-16.104 C284.017,416.802,278.559,410.082,270.938,408.484z"></path><path d="M493.243,256.135c-39.526-8.286-70.419-39.18-78.704-78.705c-1.597-7.62-8.317-13.079-16.104-13.079 c-7.786,0-14.507,5.457-16.104,13.078c-8.286,39.526-39.179,70.419-78.705,78.704c-7.62,1.597-13.079,8.318-13.079,16.104 c0,7.786,5.458,14.506,13.079,16.104c39.525,8.286,70.418,39.179,78.703,78.705c1.597,7.62,8.317,13.079,16.104,13.079 c7.786,0,14.507-5.457,16.104-13.079c8.287-39.526,39.18-70.419,78.705-78.703c7.62-1.598,13.079-8.318,13.079-16.104 S500.863,257.732,493.243,256.135z"></path></svg>`;

const CHAT_ICON = (size: number) =>
  `<svg class="madex-toggle-icon" aria-hidden="true" viewBox="0 0 64 64" width="${size}" height="${size}" fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd"><path transform="translate(-1848 -329)" d="m1907.56 356.38c.29 1.499.44 3.043.44 4.62 0 14.389-12.58 26-28 26-5.07 0-9.83-1.255-13.94-3.452-.58-.31-1.27-.316-1.86-.017-3.6 1.844-7.69 2.877-11.07 3.455-.37.063-.74-.092-.96-.397-.21-.305-.23-.706-.04-1.03 0-.003 0-.007 0-.011 1.85-3.3 3.01-7.058 3.72-10.328.11-.501.02-1.025-.25-1.463-2.29-3.767-3.6-8.12-3.6-12.757 0-14.389 12.58-26 28-26 2.26 0 4.46.249 6.56.72 1.08.24 2.15-.439 2.39-1.516s-.44-2.148-1.51-2.388c-2.39-.533-4.88-.816-7.44-.816-17.7 0-32 13.482-32 30 0 5.105 1.36 9.915 3.77 14.13-.64 2.731-1.62 5.77-3.13 8.462-.94 1.657-.84 3.722.26 5.293s3.01 2.367 4.9 2.044c3.44-.589 7.55-1.624 11.29-3.38 4.45 2.201 9.53 3.451 14.91 3.451 17.7 0 32-13.482 32-30 0-1.836-.18-3.634-.51-5.38-.21-1.084-1.26-1.793-2.35-1.584-1.08.21-1.79 1.26-1.58 2.344zm-27.56.62c2.21 0 4 1.792 4 4s-1.79 4-4 4-4-1.792-4-4 1.79-4 4-4zm-15 0c2.21 0 4 1.792 4 4s-1.79 4-4 4-4-1.792-4-4 1.79-4 4-4zm27.61-22.963-2.07 5.479c0 .006 0 .012-.01.017 0 .004-.01.008-.01.01 0 0-5.48 2.066-5.48 2.066-1.83.689-3.04 2.438-3.04 4.391s1.21 3.702 3.04 4.391c0 0 5.48 2.066 5.48 2.066 0 .002.01.006.01.01.01.005.01.011.01.017 0 0 2.07 5.479 2.07 5.479.69 1.827 2.44 3.037 4.39 3.037s3.7-1.21 4.39-3.037c0 0 2.07-5.479 2.07-5.479 0-.006 0-.012.01-.017 0-.004.01-.008.01-.01 0 0 5.48-2.066 5.48-2.066 1.83-.689 3.04-2.438 3.04-4.391s-1.21-3.702-3.04-4.391c0 0-5.48-2.066-5.48-2.066 0-.002-.01-.006-.01-.01-.01-.005-.01-.011-.01-.017 0 0-2.07-5.479-2.07-5.479-.69-1.827-2.44-3.037-4.39-3.037s-3.7 1.21-4.39 3.037zm3.74 1.411c.1-.27.36-.448.65-.448s.55.178.65.448c0 0 2.06 5.48 2.06 5.48.21.538.52 1.026.93 1.433s.89.722 1.43.925c0 0 5.48 2.066 5.48 2.066.27.102.45.36.45.648s-.18.546-.45.648c0 0-5.48 2.066-5.48 2.066-.54.203-1.02.518-1.43.925s-.72.895-.93 1.433c0 0-2.06 5.48-2.06 5.48-.1.27-.36.448-.65.448s-.55-.178-.65-.448c0 0-2.06-5.48-2.06-5.48-.21-.538-.52-1.026-.93-1.433s-.89-.722-1.43-.925c0 0-5.48-2.066-5.48-2.066-.27-.102-.45-.36-.45-.648s.18-.546.45-.648c0 0 5.48-2.066 5.48-2.066.54-.203 1.02-.518 1.43-.925s.72-.895.93-1.433c0 0 2.06-5.48 2.06-5.48z"></path></svg>`;

/** The plugin's render_interface() markup (floating variant). */
function markup(title: string) {
  const t = esc(title);
  const id = "madex-chat-1";
  return `<template data-madex-chat-template>
<div id="${id}" class="madex-chatbot-container" data-madex-chat-root data-embedded="false">
  <section class="madex-chat-window" data-madex-window aria-labelledby="${id}-title" role="dialog" aria-modal="true" hidden>
    <header class="madex-chat-header">
      <div class="madex-chat-header-info">
        <button type="button" class="madex-icon-button madex-chat-back" data-madex-back aria-label="Zurück zur Startseite" hidden>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
        </button>
        <span class="madex-chat-avatar" aria-hidden="true">${SPARKLE(20)}</span>
        <span class="madex-chat-header-text">
          <strong id="${id}-title" class="madex-chat-title">${t}</strong>
          <span class="madex-chat-status"><span class="madex-status-dot" aria-hidden="true"></span>Online · antwortet sofort</span>
        </span>
      </div>
      <button type="button" class="madex-icon-button madex-chat-close" data-madex-close aria-label="Chat minimieren">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 12h12"></path></svg>
      </button>
    </header>
    <div class="madex-chat-alert" data-madex-alert role="status" aria-live="polite" hidden></div>
    <div class="madex-chat-content" data-madex-content>
      <section class="madex-welcome" data-madex-view="welcome" aria-labelledby="${id}-welcome-title">
        <img class="madex-welcome-logo" src="/brand/logo.svg" alt="Madex IT Solutions" width="176" height="38">
        <div class="madex-welcome-copy">
          <p class="madex-eyebrow">KI-Assistent von Madex IT Solutions</p>
          <h2 id="${id}-welcome-title" tabindex="-1">Hallo, ich bin ${t} <span aria-hidden="true">👋</span></h2>
          <p>Ich beantworte Ihre Fragen zu Website, Google und Social Media, finde das passende Paket für Sie und nehme Ihre Terminanfrage auf, rund um die Uhr.</p>
        </div>
        <div class="madex-quick-actions" aria-label="Womit können wir helfen?">
          <button type="button" class="madex-quick-action madex-quick-action-primary" data-madex-action="chat">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.5A2.5 2.5 0 0 1 4 12.5z"></path></svg>
            <span>Frage stellen</span>
          </button>
          <button type="button" class="madex-quick-action" data-madex-action="appointment">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"></path></svg>
            <span>Termin anfragen</span>
          </button>
          <button type="button" class="madex-quick-action" data-madex-action="packages">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Zm-8 9 8 4 8-4M4 17l8 4 8-4"></path></svg>
            <span>Passendes Paket finden</span>
          </button>
          <button type="button" class="madex-quick-action" data-madex-action="existing-client">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
            <span>Ich bin bereits Kunde</span>
          </button>
        </div>
        <button type="button" class="madex-text-action" data-madex-action="new-client">Ich bin noch nicht Kunde <span aria-hidden="true">→</span></button>
        <div class="madex-history" data-madex-history hidden>
          <p class="madex-history-title">Ihre bisherigen Gespräche</p>
          <ul class="madex-history-list" data-madex-history-list></ul>
          <button type="button" class="madex-text-action madex-history-new" data-madex-action="new-chat"><span aria-hidden="true">+</span> Neues Gespräch beginnen</button>
        </div>
        <p class="madex-privacy-note" data-madex-privacy>Mit der Nutzung des Chats werden Ihre Nachrichten zur Bearbeitung Ihrer Anfrage gespeichert. <a href="/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutz</a></p>
      </section>
      <section class="madex-chat-conversation" data-madex-view="conversation" aria-label="Chatverlauf" hidden>
        <div class="madex-chat-messages" data-madex-messages role="log" aria-live="polite" aria-relevant="additions text"></div>
        <button type="button" class="madex-new-message-notice" data-madex-new-message hidden>Neue Nachricht ↓</button>
      </section>
      <section class="madex-flow" data-madex-view="flow" hidden>
        <div class="madex-flow-body" data-madex-flow-body></div>
      </section>
    </div>
    <div class="madex-typing-indicator" data-madex-typing role="status" aria-label="${t} schreibt" hidden><span></span><span></span><span></span></div>
    <footer class="madex-chat-input-area" data-madex-input-area hidden>
      <form class="madex-chat-form" data-madex-chat-form>
        <label class="madex-visually-hidden" for="${id}-input">Nachricht an Madex</label>
        <textarea id="${id}-input" class="madex-chat-input" data-madex-input rows="1" maxlength="1000" placeholder="Nachricht schreiben …"></textarea>
        <button type="submit" class="madex-chat-send" data-madex-send aria-label="Nachricht senden">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7M12 19V5"></path></svg>
        </button>
      </form>
    </footer>
  </section>
  <div class="madex-teaser" data-madex-teaser hidden>
    <button type="button" class="madex-teaser-body" data-madex-teaser-open>
      <span class="madex-teaser-name"><span class="madex-teaser-mark" aria-hidden="true">${SPARKLE(14)}</span>${t}</span>
      <span class="madex-teaser-text" data-madex-teaser-text></span>
    </button>
    <button type="button" class="madex-teaser-close" data-madex-teaser-close aria-label="Begrüssung schliessen">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>
    </button>
  </div>
  <button type="button" class="madex-chat-toggle" data-madex-toggle aria-expanded="false" aria-label="Madex Chat öffnen">
    ${CHAT_ICON(32)}
    <span class="madex-toggle-badge" data-madex-badge aria-hidden="true" hidden>1</span>
    <span class="madex-toggle-close" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></span>
  </button>
</div>
</template>`;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-orion="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.dataset.orion = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(src));
    document.body.appendChild(s);
  });
}

declare global {
  interface Window {
    madexChatbot?: Record<string, unknown>;
    jQuery?: unknown;
  }
}

export function Orion() {
  useEffect(() => {
    if (document.querySelector("madex-chatbot")) return;
    let cancelled = false;
    fetch("/api/site-config")
      .then((r) => r.json())
      .then(async ({ chat }: { chat: Config }) => {
        if (cancelled || !chat.enabled || document.querySelector("madex-chatbot")) return;
        const origin = window.location.origin;
        window.madexChatbot = {
          ajaxUrl: "/api/chat/ajax",
          nonce: "next",
          stylesheetUrl: `/chatbot/css/chatbot.css?ver=${ASSET_VERSION}`,
          fontsUrl: "/chatbot/fonts/",
          title: chat.name,
          welcomeMessage: chat.welcome,
          privacyUrl: "/datenschutz",
          contactEmail: "info@madex-it.ch",
          contactPhone: "052 589 67 59",
          contacts: { phones: ["052 589 67 59", "076 507 33 32"], email: "info@madex-it.ch" },
          services: SERVICE_LABELS,
          teaser: { enabled: chat.teaserEnabled, message: chat.teaserMessage, delay: chat.teaserDelay, mobile: chat.teaserMobile },
          assistantName: chat.name,
          sections: [
            { key: "pakete", label: "Pakete ansehen", url: `${origin}/#pakete`, heading: "Pakete und Preise" },
            { key: "angebot", label: "Website inklusive", url: `${origin}/#angebot`, heading: "Ihre neue Website ist inklusive." },
            { key: "ki", label: "KI-Lösungen nach Mass", url: `${origin}/marketing-solutions/ki-integration`, heading: "" },
            { key: "analyse", label: "Kostenlose Analyse", url: `${origin}/kostenlose-prufung`, heading: "" },
            { key: "kontakt", label: "Kontaktseite", url: `${origin}/kontakt`, heading: "" },
            { key: "portfolio", label: "Referenzen ansehen", url: `${origin}/website-portfolio`, heading: "" },
            { key: "webdesign", label: "Webdesign", url: `${origin}/marketing-solutions/website-development`, heading: "" },
            { key: "seo", label: "SEO-Optimierung", url: `${origin}/marketing-solutions/seo-optimierung`, heading: "" },
            { key: "google-ads", label: "Google Marketing", url: `${origin}/marketing-solutions/google-marketing`, heading: "" },
            { key: "social-media", label: "Social Media Marketing", url: `${origin}/marketing-solutions/social-media-marketing`, heading: "" },
          ],
          userName: "",
          userEmail: "",
          isLoggedIn: false,
        };
        const host = document.createElement("madex-chatbot");
        host.className = "madex-chat-host";
        host.setAttribute("data-madex-chat-host", "");
        host.setAttribute("data-embedded", "false");
        host.setAttribute("style", "all: initial; display: block;");
        host.innerHTML = markup(chat.name);
        document.body.appendChild(host);
        if (!window.jQuery) await loadScript("/chatbot/jquery.min.js");
        await loadScript(`/chatbot/chatbot.js?ver=${ASSET_VERSION}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/** Opens the chat window (used by "Assistent testen" buttons). */
export function openOrion() {
  const root = document.querySelector("madex-chatbot")?.shadowRoot;
  const win = root?.querySelector<HTMLElement>("[data-madex-window]");
  if (win && win.hidden) root?.querySelector<HTMLButtonElement>("[data-madex-toggle]")?.click();
}
