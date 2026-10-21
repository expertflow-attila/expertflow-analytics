# Kötelező e-mail-megerősítés – 2026. október 21.

## Eredmény

A regisztráció megerősítetlen fiókot hoz létre, és igazoló levelet küld. A `/verify-email` oldalon felhasználói megerősítés után engedélyezett a belépés. Az Auth.js hitelesítés és a meglévő JWT-munkamenetek ellenőrzése is vizsgálja az `emailVerifiedAt` mezőt. A korábbi, megerősítetlen fiókoknak is igazolniuk kell a címüket.

A funkció magyar nyelvű, a közös Business Native hitelesítési felületet használja. Sikertelen levélküldés után megmarad a megerősítetlen fiók, és kérhető új levél. A visszaállító és igazoló tokenek külön célhoz kötöttek; a jelszócsere nem kerüli meg a címigazolást.

## Ellenőrzött eredmények

- Production build, TypeScript és ESLint sikeres.
- **123/123** unit- és integrációs teszt, **13** fájlban.
- **24/24** Playwright-szcenárió a production builden, kihagyás nélkül.
- Új regisztráció → igazoló levél → megerősítés → belépés végigtesztelve.
- Megerősítetlen fiók helyes jelszóval is tiltva; hibás jelszóból nem szivárog az igazolási állapot.
- Régi munkamenet sem marad érvényes megerősítetlen fiókhoz.
- Lejárt, hibás, idegen célú és már felhasznált tokenek elutasítása; párhuzamos felhasználáskor egyetlen sikeres művelet.
- Küldési hiba utáni újraküldés és belépés; korábbi érvényes hivatkozás megőrzése sikertelen újraküldésnél.
- Az összes analitikai útvonal, konfigurációs funkció, webhook, SDK és AI-jogosultsági regresszió sikeres.

Minden funkcionális böngészős próba helyi, elkülönített adatbázison, tesztlevél-fogadóval és ál-AI-szolgáltatóval futott. Valódi ügyféladatot és postafiókot nem módosított. A helyi levélrögzítés a kiküldendő tartalmat ellenőrzi, nem bizonyítja az éles postafiókba kézbesítést.

Részletek és éles beállítások: [kötelező e-mail-megerősítés](../email-verification.hu.md). A képernyőképek és futási nyomok az ignorált `evals/artifacts/` könyvtárban találhatók.
