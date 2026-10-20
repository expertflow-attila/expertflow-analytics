# Business Native – Analitikai rutin

## Alap és ellenőrzési határ

Az alkalmazás közös megjelenési alapja a korábban jóváhagyott Business Native paletta és tipográfia: sötét felület, krémszínű szöveg, levendula kiemelés, Geist és Geist Mono. A bal felső részen kizárólag a `business native` szólogó és az `ANALITIKAI RUTIN` alcím szerepel; nincs `bn.` monogram.

A 2026. október 20-i módosítás az adatbázis-alapú alkalmazás egészére vonatkozik, nem a korábbi statikus mintadashboardra. A businessnative.hu aktuális oldalát a környezet hálózati szabályai blokkolták. A domaint kiszolgáló `businessnative-v2` projektet sikerült azonosítani, de a külön projekt dizájnfájljainak olvasásához az automatikus jóváhagyási ellenőrzés további felhasználói engedélyt kért. Az aktuális weboldallal való teljes egyezés ezért még nem igazolt.

A businessnative.hu és www.businessnative.hu domainek hozzáadása mentett környezeti konfigurációtervezet; a tervezet mentése nem jelent futásidejű aktiválást. Ehhez a környezeti beállítások mentése és közzététele szükséges.

## Közös elemek

- Háttér: `#0a0a0b`; kártya: `#121212`; szöveg: `#f6f3ec`; kiemelés: `#c0c0e7`.
- Geist: navigáció, címsor, törzsszöveg, számértékek. Geist Mono: kategóriacímkék, táblázatfejlécek, technikai azonosítók.
- A betűtípus-változók a HTML gyökérelemen vannak, hogy a Tailwind témaváltozói is elérjék őket. Így nem esik vissza a felület rendszerbetűre.
- Kártyasugár: 12 px; beviteli mező és gomb: 8 px. Diszkrét keretek, azonos felület- és állapotszínek.
- Címsor: 24–30 px; fő mutatók: 24–36 px; számoszlopok: tabuláris számjegyek.
- Magyar szám-, százalék-, pénznem-, időtartam- és dátumformátum. A pénzügyi számítás továbbra is a legkisebb pénzegységekben történik.
- Asztali nézetben rögzített oldalsó navigáció; mobilon nyitható, feliratozott menü, teljes navigációval és kijelentkezéssel.
- Közös `Brand` és `AuthShell` a belépés, regisztráció, jelszókezelés, kijelentkezés és a nem található oldal számára.
- Látható billentyűzetfókusz, tartalomra ugró hivatkozás, képernyőolvasóval azonosítható menü és magyar vászonvezérlők.

## Magyar felület

A menük, űrlapok, súgók, szerveroldali validációk, állapotok, üres nézetek, determinisztikus összefoglalók és AI-kérdésjavaslatok magyarul jelennek meg. Az AI rendszerutasítása magyar választ kér, de ez élő modellteszt nélkül nem bizonyítja egy külső szolgáltató minden válaszának nyelvét.

A tárolt enumok, eseményazonosítók, API-mezők és végpontok nem változtak. A rendszer címkéit a `src/lib/labels.ts` jeleníti meg magyarul. A felhasználói projektneveket, termékneveket és már mentett tölcsérneveket nem írjuk át; ezért egy korábbi angol nevű demóadat továbbra is angol lehet. Az új beépített tölcsérsablonok nevei magyarok.

## Ellenőrzés

A `evals/localization.spec.cjs` a belépési és hibaoldalak magyar szövegét, a tényleges Geist betűcsaládot, a kártyasugarat, valamint a mobilos navigáció és kijelentkezés teljes folyamatát vizsgálja. A `evals/audit.spec.cjs` az összes analitikai oldalt ellenőrzi, és 390/320 px szélességnél az oldalszintű túlcsordulásra is hibát jelez. A hitelesítési oldalak 320, 390, 768 és 1440 px szélességgel szerepelnek az ellenőrzésben.

A képernyőképek és nyomkövetések az ignorált `evals/artifacts/` mappába kerülnek; éles titkokat és felhasználói munkameneteket nem tárolunk a tárolóban. A helyi tesztek eredménye nem helyettesíti az éles telepítés ellenőrzését.
