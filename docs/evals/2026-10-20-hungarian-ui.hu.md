# Magyar felület és közös dizájn – 2026. október 20.

## Eredmény és terjedelem

Az analitikai oldalak, az ügyféladatlap, a munkaterület létrehozása, a hitelesítési oldalak, a kijelentkezés és a hibaoldalak magyar szöveget és közös megjelenést kaptak. A menük, űrlapok, validációs üzenetek és üres állapotok is magyarok. A számok, százalékok, dátumok és időtartamok magyar formátumot használnak.

A közös stílus a korábban jóváhagyott Business Native palettát követi: sötét háttér, krémszínű szöveg, levendula kiemelések, Geist/Geist Mono, 12 px kártyák és 8 px vezérlők. A mobilmenü az összes analitikai oldalhoz hozzáférést ad. A már tárolt felhasználói nevek, eseményazonosítók és API-mezők nem változtak.

## Eval és javítás

- A teljes helyi Playwright-futtatás: **20/20 sikeres**, kihagyott teszt nélkül.
- Unit- és integrációs tesztek: **104/104 sikeres**, 11 fájlban.
- Analitikai motorok: **8/8 sikeres**.
- Production build, TypeScript és ESLint: sikeres.
- Az összes analitikai útvonal asztali és mobilos ellenőrzése; 320 és 390 px szélességnél nincs oldalszintű vízszintes túlcsordulás.
- A belépési, regisztrációs, jelszókezelési és 404-oldalak ellenőrzése 320, 390, 768 és 1440 px szélességen.
- Magyar mobilmenü, beállításokhoz navigálás és kijelentkezés végigtesztelve.
- A teszt a ténylegesen megjelenő betűcsaládot vizsgálja. Ezzel feltártuk és javítottuk a Geist CSS-változóinak hibás hatókörét: a változóosztályok a HTML gyökérelemre kerültek.
- A végső kódellenőrzésnél visszaállítottuk az integrációs űrlap belső `provider` mezőnevét. A magyarítás a megjelenítési szövegre vonatkozik.
- E korrekció után új production build és ESLint futott sikeresen, majd az integrációt, kulcskezelést, tölcsérszerkesztést és jogosultságokat vizsgáló Playwright-szcenárió ismét sikeres lett (**1/1**). A teljes 20 szcenáriós futtatás ezt a végső mezőnév-korrekciót megelőzte.

A tesztek helyi, elkülönített PostgreSQL-adatbázison, mesterséges adatokkal futottak. A képernyőképek és trace-ek az ignorált `evals/artifacts/` könyvtárban vannak.

## Ellenőrzési határok

A businessnative.hu aktuális weboldalát a környezet hálózati szabályai blokkolták. A külön weboldalprojekt forrásfájljainak olvasását az automatikus jóváhagyási ellenőrzés külön engedélyhez kötötte. Az aktuális weboldallal való pontos egyezés ezért még nincs igazolva; a részleteket a [dizájnrendszer](../design-system.md) rögzíti.

Az AI magyar válaszát rendszerutasítás kéri; élő Anthropic/OpenAI/Ollama-válasz nem része ennek az ellenőrzésnek. A jelszó-visszaállító levélküldés továbbra sincs implementálva, ezt a felület magyarul egyértelműen jelzi. A helyi teszteredmények nem helyettesítik az éles telepítés és a GitHub CI külön ellenőrzését.
