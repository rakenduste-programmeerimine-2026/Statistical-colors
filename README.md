# Statistical-colors – Värvi tükeldaja

Veebirakendus, mis loendab üleslaaditud piltidelt kõik kasutatud värvid ja nende
osakaalu täpselt, ilma värve paletiks ümardamata.

## Tehnoloogiad

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Supabase](https://supabase.com) (andmebaas, storage, anonüümne sisselogimine)
- [Vercel](https://vercel.com) (deploy)

## Arenduskeskkonna seadistamine

Eeldused: Node.js 24 (vt `.nvmrc`; min 22.22) ja npm.

```bash
git clone https://github.com/rakenduste-programmeerimine-2026/Statistical-colors.git
cd Statistical-colors
npm install
npm run dev
```

Rakendus avaneb aadressil http://localhost:3000.

## Skriptid

| Käsk                | Mida teeb                       |
| ------------------- | ------------------------------- |
| `npm run dev`       | Arendusserver                   |
| `npm run build`     | Produktsiooni build             |
| `npm run start`     | Käivitab buildi                 |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScripti tüübikontroll       |
| `npm test`          | Ühiktestid (Vitest)             |
| `npm run test:watch`| Testid jälgimisrežiimis         |
| `npm run test:coverage` | Testid + katvuse raport     |

## Roadmap

Värvituvastuse plaan, etapid ja milestone'id: [`docs/roadmap.md`](docs/roadmap.md).

## Supabase

Kontot kasutaja ei loo: äpp kasutab Supabase'i *anonymous sign-in*'i, nii et
iga brauser saab nähtamatu kasutaja ID ja RLS näitab igaühele ainult tema enda
analüüse.

| Keskkond             | Supabase                                         |
| -------------------- | ------------------------------------------------ |
| Arendus              | **kohalik** Supabase (`npx supabase start`)      |
| Testid (`npm test`)  | PGlite – Postgres mälus, Dockerit pole vaja      |
| Verceli preview      | tiimi pilves projekt                             |
| Verceli production   | sama pilves projekt                              |

### Kohalik arendus (iga tiimiliige)

Vajab Dockerit.

```bash
npx supabase start    # käivitab kohaliku Supabase'i ja rakendab migratsioonid
npx supabase status   # näitab API URL-i ja publishable key't
```

Kopeeri `.env.example` → `.env.local` ja pane sinna `supabase status` väljundist
API URL ja publishable key. `.env.local` ei lähe Giti. *Secret* / `service_role`
võtit ei kasutata äpis ega jagata kunagi.

### Andmebaasi skeem

Kõik muudatused on SQL-migratsioonidena kaustas [`supabase/migrations`](supabase/migrations)
ja käivad läbi PR-i.

| Tabel          | Sisu                                                                  |
| -------------- | --------------------------------------------------------------------- |
| `images`       | Üks rida pildi kohta: formaat, mõõdud, unikaalsete värvide arv, CSV tee |
| `image_colors` | Pildi top N värvi: r, g, b, (a), hex, pikslite arv, osakaal %, kasutaja lipp |

Täielik värvide nimekiri (võib olla sadu tuhandeid ridu) salvestatakse CSV-na
privaatsesse Storage bucketisse `reports`, kausta `{kasutaja_id}/`.

### Migratsioonide rakendamine pilves projektile (DB roll)

Production ja preview kasutavad sama andmebaasi ning `main` läheb pärast rohelist
CI-d kohe production'isse. Seepärast:

1. Migratsioon tuleb **oma PR-is** ja rakendatakse pilves projektile kohe pärast
   selle merge'i (DB testid rohelised).
2. Kood, mis uut skeemi vajab, merge'itakse **alles pärast seda**.
3. Migratsioon peab töötama ka juba deploy'tud koodiga (nt uus veerg vaikeväärtusega,
   mitte olemasoleva ümbernimetamine).

```bash
npx supabase login
npm run db:link    # vali tiimi projekt (küsib DB parooli)
npm run db:push    # rakendab uued migratsioonid pilves olevale projektile (--remote)
npm run db:types   # uuendab src/lib/supabase/database.types.ts
```

Andmebaasi testid (`tests/db`) käivitavad samad migratsioonid PGlite'is
(Postgres mälus) – Dockerit ega päris Supabase'i pole testimiseks vaja.

## Deploy

Production: **https://statistical-colors.vercel.app**

Deploy käib GitHub Actionsiga ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
läbi Vercel CLI. Verceli GitHubi rakendust ei kasutata.

- **Preview:** iga PR `main`-i või `develop-frontend`-i vastu saab oma preview
  deploy ja lingi PR-i kommentaarina. Iga uus push uuendab sama kommentaari.
- **Production:** iga merge `main`-i läheb production'isse, aga **alles siis,
  kui CI** (lint, typecheck, testid, build) **on sellel commitil roheline**.
- Preview ja production kasutavad **sama pilves Supabase projekti**. Preview,
  mis vajab veel rakendamata migratsiooni, võib seetõttu ebaõnnestuda.

Seadistus väljaspool repot (DB roll):

| Kus           | Mis                                                                    |
| ------------- | ---------------------------------------------------------------------- |
| Vercel        | projekt `statistical-colors` (Hobby), env `NEXT_PUBLIC_SUPABASE_URL` ja `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production, Preview) |
| GitHub        | repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`      |
| Vercel        | Git'iga ühendamata ([`vercel.json`](vercel.json) keelab Git-deploy'd); Deployment Protection → Vercel Authentication väljas, et preview-lingid oleksid tiimile nähtavad |
| Supabase      | pilves projekt, anonymous sign-ins sees                                |

- `VERCEL_TOKEN` kehtib ainult Verceli tiimi piires ja aegub 90 päevaga
  (2027-02-16), siis tuleb luua uus token ja `gh secret set VERCEL_TOKEN`.
- Forkidest tulnud PR-id deploy't ei saa. Kõigil, kellel on repos kirjutamisõigus,
  on workflow kaudu ligipääs tokenile – see on teadlik valik ühe tokeniga tiimis.
- **Rollback:** käivita GitHub Actionsis vana `main`-i commiti CI uuesti
  ("Re-run") – roheline CI deploy'b selle commiti uuesti production'isse.
- PR-id `develop-frontend`-i vastu saavad preview alles siis, kui `deploy.yml`
  on ka `develop-frontend`-is.

## Töövoog

- Iga töö algab **issue'st**. Branchi nimi: `<tüüp>/<issue-nr>-<lühikirjeldus>`,
  nt `feat/12-color-counting`.
- Commitid järgivad [Angular commit convention](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)'it:
  `feat(core): count unique colors (#12)`.
- `main`-i otse ei pushita – kõik läheb läbi pull requesti.
