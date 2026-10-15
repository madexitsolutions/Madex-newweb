---
target: home page
total_score: 21
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/Madex-newweb/src/app/(site)/page.tsx"
target_fingerprint: "sha256:a4d12cebf5b4494251117d2437bc7b2e86d3c59ef8dbdf0faa2e33e1bd89fea0"
target_path: /home/user/Madex-newweb/src/app/(site)/page.tsx
timestamp: 2026-10-15T11-13-31Z
slug: src-app-site-page-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score (Persuade mode)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Hero form has sending/done/error + reference; preloader blocks every full load up to ~5.6s |
| 2 | Match System / Real World | 3 | Offerte metaphor excellent; rotator yields "Code & KI in neue Kunden", JS snippets mean nothing to SME owners |
| 3 | User Control and Freedom | 2 | Orion teaser permanently covers bottom-right; rotator/typing can't be paused |
| 4 | Consistency and Standards | 2 | 6+ CTA labels for the same /kostenlose-prufung; 5 stars beside 4.4; 100+ vs 35+ |
| 5 | Error Prevention | 3 | Email required + honeypot; native validation bubble (English in EN browsers) |
| 6 | Recognition Rather Than Recall | 3 | Pricing tiers list different features in different order, hard to compare |
| 7 | Flexibility and Efficiency | n/a | Landing page; no expert workflows |
| 8 | Aesthetic and Minimalist Design | 2 | 6 overlapping animated hero cards; duplicate closing CTAs |
| 9 | Error Recovery | 3 | Errors fall back to phone number |
| 10 | Help and Documentation | n/a | Marketing page; FAQ + chatbot cover it |
| **Total** | | **21/32** | **Acceptable (66%)** |

## Design Specificity Verdict
Middle of the page is authored (Offerte quote card, Garage-Muster AI demo, real portfolio). Hero collage (particles, glass cards, fake metrics, code) and 3D clipart (lightbulb, rocket) are category-interchangeable. Detector: 1 CLI advisory (codex-grid-background, home.css:9); browser overlay 43 desktop / 32 mobile findings: cyan gradient ×18, low-contrast ×10, dark-glow ×5, gray-on-color ×5, nested-cards ×4 (chat bubbles/pricing — false positives), gradient-text ×2, blinking-cursor ×2, radial glow ×2, marquee ×1. Real: white on #028d86 = 4.07:1 and #028d86 text on light = 3.8–4.0:1 (fail AA, brand tokens site-wide); code-comment tokens 2.6:1.

## Priority Issues
- [P1] One offer, too many CTA names and unclear price (6+ labels → same form; "Angebot sichern" sounds binding; Basic "Am häufigsten gewählt" shows no price; Wartung "Website inklusive" muddles the pitch). Fix: one primary verb + one secondary, tier passed to the form, term disclosed near CTAs. → clarify
- [P1] Overlays: preloader on every full load (~5.6s max); Orion teaser permanently covers content. Fix: preloader once per session; teaser auto-hides. → optimize / quieter
- [P1] Brand teal fails AA: white on #028d86 buttons 4.07:1; teal text on light 3.8–4.0:1. Fix: darker action teal for text/buttons, keep #028d86 as accent. → polish
- [P2] Trust signals contradict: 5 stars for 4.4, 100+ vs 35+, logos alt "Kundenlogo". → harden
- [P2] Mobile defects: CtaBand button overflows (right edge 407px @390), testimonial squeezed, 37 tap targets <44px (testimonial dots 5px tall), no persistent CTA. → adapt
- [P2] Hero noise (user-requested direction kept): code-comment contrast 2.6:1, rotator aria-live announces every 2.6s, rotating words all in H1 accessible text, H2 word-split spans read "Waswirtun". → polish

## Persona Red Flags
Jordan: "Code & KI in neue Kunden" + code editor reads as dev shop; doesn't know what the Gratis-Analyse delivers; "Angebot sichern" feels binding.
Riley: 5★ vs 4.4, 100+ vs 35+, unsourced +184%; 12-month term only in an 11px caption; pricing CTAs don't pass the tier.
Casey: no persistent CTA after the hero; 20px footer links; clipped CtaBand arrow; services list greys 8 of 9 items so they look disabled.

## Minor Observations
Offerte punctuation renders spaced ("8'000 . 00"); steps 3-4 are benefits not steps; pricing footer ragged on mobile; LCP image warnings; CtaBand + footer CTA duplicate.

## Questions to Consider
Why isn't the Offerte card (the real persuader) in the first viewport? What does the Gratis-Analyse actually deliver — can we show a sample? Is "Auf Anfrage" costing leads right after "Keine versteckten Kosten"?
