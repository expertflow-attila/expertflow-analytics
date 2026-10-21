# Jelszó-visszaállítás javítása – 2026. október 21.

## Hiba és javítás

A visszaállítási űrlap korábban minden érvényes kérésre a hiányzó levélküldés hibáját adta. Tényleges levélküldő implementáció nem volt. Az új megoldás Resend szolgáltatón keresztül küldi ki az egyszer használható, 30 percig érvényes hivatkozást. A böngészőben megadható az új jelszó, majd azzal be lehet lépni.

A tokeneket SHA-256 lenyomatként tároljuk, és atomi tranzakcióban fogyasztjuk el. A küldést egyperces, adatbázisban szerializált korlát védi. A küldési hiba nem érvényteleníti a korábbi, működő hivatkozást. A hiányzó konfiguráció és a küldési korlát egyértelmű hibát ad; ezeknél a felület nem állítja, hogy levelet küldött.

A belépés normalizálja az e-mail-címet, és megkülönbözteti a hibás hitelesítő adatokat a szolgáltatás elérhetetlenségétől.

## Helyi ellenőrzés

- 112 automatikus teszt sikeres, 12 fájlban.
- Production build, TypeScript és ESLint: sikeres.
- Hat Playwright-szcenárió sikeres a production builden, a magyar hitelesítési oldalak és a beállítási funkciók ellenőrzésével együtt.
- A célzott böngészős ellenőrzés végigjárja a levél → új jelszó → régi jelszó elutasítása → új jelszóval belépés folyamatot, majd a már felhasznált hivatkozás elutasítását.
- Külön böngészős szcenárió vizsgálja a hiányzó levélküldési konfiguráció és az érvénytelen hivatkozás kezelését.
- A levélküldés a helyi böngészős tesztben rögzítő tesztszolgáltatón halad át; valódi levél nem megy ki. Ez nem igazolja az éles Resend-kézbesítést.

## Éles ellenőrzéshez szükséges feltételek

A vizsgálatkor a korábban használt Vercel-token `invalidToken` választ kapott. Új bejelentkezés indult. Az éles környezeti változók megléte és a felhasználói fiók állapota ezért e helyi ellenőrzésből nem állapítható meg.

A tényleges éles helyreállításhoz érvényes Vercel-hozzáférés, ellenőrzött feladói domain, a `RESEND_API_KEY` és `EMAIL_FROM` beállítása, valamint valós kézbesítési próba szükséges. A teendőket és az ellenőrzési korlátokat a [jelszó-visszaállítás dokumentációja](../password-recovery.md) részletezi.
