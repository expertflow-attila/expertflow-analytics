# Kötelező e-mail-megerősítés

Új regisztrációkor a fiók megerősítetlen állapotban jön létre. A rendszer Resenden keresztül küld megerősítő levelet, és a `/verify-email` oldalra irányít. A levél hivatkozását megnyitva a felhasználó az **E-mail-cím megerősítése** gombbal igazolja a címét, majd a saját jelszavával beléphet.

## Belépési szabály

A hitelesítetlen fiók helyes jelszóval sem léphet be. A meglévő JWT-munkamenetek ellenőrzése is vizsgálja a fiók aktuális `emailVerifiedAt` értékét, ezért egy régebbi munkamenet sem kerüli meg ezt a szabályt. A korábban létrehozott, még nem igazolt fiókoknak is megerősítő levelet kell kérniük. A már megerősített fiókok változatlanul használhatók; a helyi seed demófiókja eleve megerősített.

## Levelek és helyreállítás

A szerveroldali `RESEND_API_KEY` és `EMAIL_FROM` beállítások közösek a jelszó-visszaállítással. A feladói domainnek ellenőrzöttnek kell lennie a Resendben. A `NEXT_PUBLIC_APP_URL` az éles alkalmazás címe legyen. E változók módosítása után új telepítés szükséges.

Sikertelen regisztrációs levélküldéskor a fiók megmarad megerősítetlenként, a felület pedig hibát jelez és újraküldést kínál. Az újraregisztrálás nem írhatja felül egy már létező fiók jelszavát. A `/verify-email` oldalon ismeretlen vagy már megerősített címhez is ugyanaz a nyilvános tájékoztatás jár; levél csak létező, még nem megerősített fióknak megy.

## Tokenek

- Véletlen, 256 bites token; 24 órás érvényesség; egyszeri felhasználás.
- Az adatbázis csak az `email-verification:` előtagú SHA-256 lenyomatot tárolja. A visszaállító tokenek külön célt és előtagot használnak.
- A link megnyitása (`GET`) nem igazolja a címet: a művelet a felhasználó megerősítő `POST` kérésével történik, így a levelezők linkellenőrzői nem fogyasztják el automatikusan a linket.
- Atomi tokenfogyasztás és címigazolás, azonos fiókra szerializált tranzakciókkal. Párhuzamos beküldéskor csak egy kérés lehet sikeres.
- Fiókonként egyperces, az adatbázisban is érvényesített küldési korlát. További folyamatonkénti három kérés / 15 perc korlát; több példányra a meglévő Redis-támogatás használható.
- Sikertelen újraküldés megőrzi a korábbi, még érvényes linket. Sikeres újraküldés lecseréli azt. Sikeres igazolás elfogyasztja a fiók további igazoló tokenjeit.
- A jelszó-visszaállítás nem igazolja automatikusan az e-mail-címet. A két művelet egymástól független.
- A link és a token nem kerül naplóba vagy nyilvános műveleti válaszba. A szervernapló csak a szolgáltatói elfogadás azonosítóját vagy szűkített hibakódját tárolja; az elfogadás nem azonos a postafiókba kézbesítéssel.

## Ellenőrzés

A `tests/integration/email-verification.test.ts` valódi elkülönített PostgreSQL-adatbázison ellenőrzi a regisztrációt, az egyszeri és lejárt tokeneket, a párhuzamos kéréseket, az újraküldést, a hibás kézbesítést, a jelszó felülírásának tiltását, valamint a belépési szabályt. A Next/Auth.js környezeti hibakezelését a valódi production builden futó Playwright-szcenáriók vizsgálják.

A `evals/email-verification.spec.cjs` végigjárja a megerősítés előtti tiltást, a megerősítés utáni belépést, a régi munkamenetek ellenőrzését, a lejárt és már felhasznált linkeket, valamint az újraküldést és a küldési hiba utáni helyreállítást. A leveleket helyi tesztfogadó rögzíti; a helyi siker nem igazolja az éles Resend-kézbesítést.
