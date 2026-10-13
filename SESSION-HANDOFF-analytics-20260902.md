# expertflow-analytics — átadó egy új sessionhez

> Készült: 2026-09-02. Az a kérdés hívta életre, hogy van-e az appban be nem
> fejezett vagy nem élesített munka. **Van.**

## Egy mondatban

A `main` ágon futó ÉLES oldal még a régi, kitalált adatú változat; egy 2026-08-27-én
készült teljes átépítés (`agent/funnel-intelligence-os`) fel van töltve GitHubra és
sikeresen le is buildelt preview-ként, de **soha nem került be a main-be, tehát soha
nem élesedett.**

## Hol mi van

| | |
|---|---|
| Lokál | `~/Projects/expertflow-analytics` |
| GitHub | `expertflow-attila/expertflow-analytics` |
| Vercel projekt | `expertflow-analytics` (`prj_tf3Q6dpEdLY5bWHvw3yNWt6KYA9y`) |
| Éles URL | https://expertflow-analytics.vercel.app |
| Munkafa | tiszta (csak két `.DS_Store`) |
| Nem pusholt commit | nincs |

## Ágak

- **`main`** — 5 commit. Utolsó: `Rebrand to Business Native + add funnel analysis,
  mark all data as sample` (2026-08-19). **Ez fut élesben.**
- **`agent/funnel-intelligence-os`** — 4 commit (2026-08-27), a main előtt.
  **Nincs mergelve, nincs PR, nincs production deploy.**
- **`codex/phase-1-foundation`** — 0 commit a mainhez képest, tehát üres/lemaradt ág.

## Mit tartalmaz a nem élesített ág

Nem ráépítés, hanem **csere**: 38 fájl, +1091 / −3504 sor.

Kikerült: `src/components/Dashboard.tsx` (888 sor) és `src/lib/posthog.ts` (402 sor —
ez volt a fix seedű álvéletlen-generátor, ami a kitalált adatokat gyártotta).

Bekerült: `FunnelIntelligenceOS.tsx`, `src/lib/analytics.ts` + unit teszt,
`event-schema.ts`, `demo-data.ts`, esemény-fogadó végpontok
(`/api/v1/events`, `/api/v1/events/batch`, `/api/health`), böngésző SDK
(`public/funnel-sdk.js`), Dockerfile + docker-compose, GitHub Actions CI,
és négy dokumentum (`docs/analytics.md`, `architecture.md`, `attribution.md`,
`privacy.md`). A projekt neve `funnel-intelligence-os`-ra változott, és bejött
`@xyflow/react` (folyamatábra-vászon), valamint `typecheck` / `test` / `lint` script.

## Miért érdekes ez

A 2026-08-17-i döntés (`memory/project_bn_analitikai_rutin_dashboard_20260817.md`)
azért ejtette az élesítést, mert az app **kitalált adatot mutatott valódiként**, és a
hitelesség-szabály ezt tiltja. Ez az ág pont erre válaszol: a README szerint a felület
**kifejezetten megjelölt mintaadatot** használ, az esemény-fogadás pedig
**fail-closed** marad, amíg nincs valódi `EventStore` beállítva.

Vagyis a blokkoló ok, ami miatt a kártya élő link nélkül maradt a
businessnative.hu/projektek oldalon, ebben az ágban meg van oldva — csak senki nem
vitte végig.

## Deploy-előzmény

```
2026-08-27 10:43  preview     READY    agent/funnel-intelligence-os   <-- ez az utolso allapot
2026-08-27 10:40  preview     ERROR    agent/funnel-intelligence-os
2026-08-19 10:44  production  READY    main                           <-- ez fut most elesben
2026-03-13 22:38  production  READY    main
```

A 10:40-es preview elhasalt, a 10:43-as (`fix: keep standalone output for
self-hosting only`) már zöld. A preview URL bejelentkezés-védett (302).

## Nyitott kérdések, mielőtt bárki hozzányúl

1. **Akarjuk-e egyáltalán élesíteni?** A `main` ma is működő oldalt szolgál ki.
   Az ág átnevezné a terméket (`funnel-intelligence-os`), ami márka-döntés.
2. **A hozzáférési akadályok NEM oldódtak meg** a 08-17-i memória szerint: a PostHog
   `phc_` kulcs esemény-küldő, nem API-olvasó; a GA4-hez nincs `analytics.readonly`
   scope; a Plausible Stats API-kulcs hiányzik. Az ág saját esemény-fogadót hoz
   (`/api/v1/events`), ami megkerüli ezt — de akkor saját adatgyűjtés kell.
3. **A businessnative.hu „Analitikai rutin" kártyája** ma szándékosan élő-oldal gomb
   nélkül áll (`rendszerek-content.mjs` PROJEKTEK_SLUGS). Ha ez élesedik, oda
   visszakerülhet a link.

## Első lépések egy új sessionben

```bash
cd ~/Projects/expertflow-analytics
git fetch origin
git log --oneline origin/main..origin/agent/funnel-intelligence-os
git diff --stat origin/main...origin/agent/funnel-intelligence-os
git checkout -b nezes origin/agent/funnel-intelligence-os && npm install && npm run dev
```
