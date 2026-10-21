# Jelszó-visszaállítás

A `/forgot-password` oldal a fiók e-mail-címére küld egyszer használható, 30 percig érvényes hivatkozást. Az új jelszó a `/reset-password` oldalon adható meg. A korábbi jelszó ezután nem használható.

## Éles levélküldés

A Resend szolgáltatásban ellenőrzött feladói domain és két szerveroldali környezeti változó szükséges:

```dotenv
RESEND_API_KEY=re_your_private_api_key
EMAIL_FROM="Business Native <noreply@your-verified-domain.hu>"
NEXT_PUBLIC_APP_URL=https://your-analytics-deployment.example
```

A változókat a megfelelő Vercel-projekt Production környezetében kell megadni, majd új telepítést indítani. A kulcsot ne tedd a forráskódba, a kliensoldali `NEXT_PUBLIC_*` változók közé vagy naplóba. A tesztkulcs és a helyi tesztlevél-fogadó nem alkalmas éles kézbesítésre. A változók megléte önmagában nem bizonyítja a domain ellenőrzését vagy a beérkező postafiókba való kézbesítést; ezt valódi kéréssel és a szolgáltató kézbesítési állapotával kell ellenőrizni.

Konfiguráció nélkül a kérés egyértelmű hibát ad és nem állít elő visszaállító tokent. Szolgáltatói hiba esetén a sikertelen küldéshez tartozó token törlődik, a korábbi érvényes hivatkozás megmarad.

## Működés és korlátok

- Kriptográfiailag véletlen, 256 bites token. Az adatbázis csak a `password-reset:` előtaggal ellátott SHA-256 lenyomatot tárolja.
- A visszaállítás atomi tranzakcióban fogyasztja el a tokent és módosítja a jelszót. Párhuzamos beküldésnél csak egy kérés lehet sikeres. A jelszóváltás érvényteleníti a fiók többi visszaállítási tokenjét is.
- A regisztrált és ismeretlen cím normál kérésre ugyanazt a nyilvános megerősítést kapja. Ismeretlen címre nem küldünk levelet és nem hozunk létre fiókot. Szolgáltatói elutasítás esetén a ténylegesen küldött kérés hibát jelez.
- Adatbázisban szerializált, fiókonként egyperces küldési korlát, amely a serverless példányok között is érvényes. További folyamatonkénti korlát: három kérés 15 perc alatt; ennek több példányra kiterjedő érvényesítéséhez a meglévő Redis-támogatás szükséges.
- A régi jelszó visszafejtése helyett a felhasználó saját új jelszót ad meg. A levélben és a naplóban nincs jelszó. A visszaállítási hivatkozás nem kerül a böngészőnek adott műveleti válaszba.
- A már kiadott JWT-munkameneteket ez a változtatás nem vonja vissza; a jelszóváltás az új bejelentkezéseket érinti.
- A belépés levágja az e-mail-cím körüli szóközöket és egységesíti a kis-/nagybetűket. A szolgáltatási hibát eltérő üzenettel jelzi a hibás hitelesítő adatoktól.

## Helyi böngészős ellenőrzés

A `tests/integration/password.test.ts` valódi, elkülönített PostgreSQL-adatbázison vizsgálja a tokentárolást, a lejáratot, az egyszeri felhasználást, a párhuzamos kéréseket és a kézbesítési hibát. A `src/server/password-recovery.test.ts` a Resend HTTP-kérést és a hibakezelést ellenőrzi.

A `evals/password-delivery.spec.cjs` a teljes folyamatot vizsgálja: regisztráció, visszaállító levél, új jelszó mentése, a régi jelszó elutasítása, belépés az újjal, a felhasznált link elutasítása. Ehhez helyi alkalmazás kell a 3102-es porton, valamint a tesztlevél-fogadó a 3199-es porton:

```sh
node evals/helpers/password-mail-mock.cjs
```

Másik terminálban, elkészült builddel és helyi tesztadatbázissal:

```sh
AUTH_URL=http://localhost:3102 AUTH_TRUST_HOST=true \
NEXT_PUBLIC_APP_URL=http://localhost:3102 \
RESEND_API_KEY=re_local_eval_only \
EMAIL_FROM='Business Native <local@example.test>' \
NODE_OPTIONS="--require $(pwd)/evals/helpers/password-mail-hook.cjs" \
node_modules/.bin/next start -p 3102
```

Majd:

```sh
node_modules/.bin/playwright test --config=evals/playwright.config.cjs evals/password-delivery.spec.cjs
```

A hook kizárólag a helyi tesztfolyamatban téríti el a Resend-kérést a helyi fogadóhoz. Az alkalmazáskód nem importálja; élesben nem szabad `NODE_OPTIONS`-ként megadni. A helyi ellenőrzés nem küld valódi e-mailt, és nem igazolja az éles kézbesítést.
