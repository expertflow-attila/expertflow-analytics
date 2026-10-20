# Business Native Analytics — eval-protokoll

2026-10-20. A tárolóban nem találtam külön, név szerint definiált eval-protokollt; ez az audit során létrehozott követelményalapú protokoll, nem egy külső szabvány átvételének állítása.

1. **Rögzített alap:** commit, lockfile, production build, külön Postgres, determinisztikus seed. Éles adat és külső fizetős API nem része a tesztnek.
2. **Funkcióleltár:** minden létező oldal, HTTP-végpont, szerverművelet, SDK és számítási motor. A hiányzó funkció NEM IMPLEMENTÁLT, a nem futtatott integráció NEM ELLENŐRZÖTT; egyik sem PASS.
3. **Előre meghatározott elvárás:** input → várt eredmény; pozitív, hibás input, jogosultsági és üres állapot. Pénzügyi számításnál kézzel kiszámolt független fixture. A vizsgált implementáció eredményét nem tekintjük automatikusan helyes orákulumnak.
4. **Végrehajtás:** Playwright CLI + Chromium production builden; APIRequestContext a HTTP-végpontokra; valódi izolált Postgres; meglévő Vitest és független motor-evalok. AI-szimuláció csak tesztmock, nem élő adapterminősítés.
5. **Bizonyíték:** tesztforrás, JSON riport, screenshot, szükség esetén lokális trace; a hiba leírása tartalmazza a kiváltó lépést, elvárt/tényleges eredményt, hatást, fájlt és súlyosságot.
6. **Hibatriázs:** különítsük el a teszt saját hibáját, környezeti hibát, termékhibát és hiányzó implementációt. Hibás tesztorákulumot javítani kell, de termékhibát nem szabad elvárásmódosítással elfedni.
7. **Javítási ciklus:** előbb reprodukáló piros eval → legkisebb megfelelő javítás → azonos eval zöld → érintett regressziós kör → build/typecheck/lint. Auth/tenant és adatvesztési javítás esetén kötelező negatív esetek; UI-nál 320/390/1440 px ellenőrzés.
8. **Kiadási kapu:** nulla nyitott P0/P1; a javított funkciók evaljai zöldek; kötelező ellenőrzés nem marad SKIPPED/UNRUN; az összes maradó P2/P3 dokumentált és tudatosan elfogadott. Az élő deploy és a külső szolgáltatók külön verifikációt igényelnek.

Állapotok: PASS / FAIL / BLOCKED / UNRUN / NOT IMPLEMENTED. Súlyosság: P1 jogosultsági hiba vagy adatvesztés; P2 érdemi működési/használhatósági hiba; P3 vizuális/pontossági kisebb eltérés. Súlyozott átlag nem fedhet el biztonsági FAIL-t.

Az eredeti audit piros tesztjei az evals/ könyvtárban regressziós ellenőrzésekként megmaradnak. A javítások utáni eredményeket a 2026-10-20-fixes.hu.md rögzíti. A helyi zöld eval nem helyettesíti az éles telepítés és az élő szolgáltatók ellenőrzését.
