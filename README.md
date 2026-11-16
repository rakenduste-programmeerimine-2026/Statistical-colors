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

## Supabase

Tiimil on **üks ühine Supabase projekt**. Kontot kasutaja ei loo: äpp kasutab
Supabase'i *anonymous sign-in*'i, nii et iga brauser saab nähtamatu kasutaja ID
ja RLS näitab igaühele ainult tema enda analüüse.

### Ühendamine (iga tiimiliige)

1. Kopeeri `.env.example` → `.env.local`.
2. Küsi DB rollilt projekti URL ja **publishable key** ning pane need `.env.local`-i.
   `.env.local` ei lähe Giti. *Secret* / `service_role` võtit ei jaga kunagi.

### Andmebaasi skeem

Kõik muudatused on SQL-migratsioonidena kaustas [`supabase/migrations`](supabase/migrations)
ja käivad läbi PR-i.

| Tabel          | Sisu                                                                  |
| -------------- | --------------------------------------------------------------------- |
| `images`       | Üks rida pildi kohta: formaat, mõõdud, unikaalsete värvide arv, CSV tee |
| `image_colors` | Pildi top N värvi: r, g, b, (a), hex, pikslite arv, osakaal %, kasutaja lipp |

Täielik värvide nimekiri (võib olla sadu tuhandeid ridu) salvestatakse CSV-na
privaatsesse Storage bucketisse `reports`, kausta `{kasutaja_id}/`.

### Migratsioonide rakendamine (DB roll)

```bash
npx supabase login
npm run db:link    # vali tiimi projekt
npm run db:push    # rakendab uued migratsioonid
npm run db:types   # uuendab src/lib/supabase/database.types.ts
```

Andmebaasi testid (`tests/db`) käivitavad samad migratsioonid PGlite'is
(Postgres mälus) – Dockerit ega päris Supabase'i pole testimiseks vaja.

## Töövoog

- Iga töö algab **issue'st**. Branchi nimi: `<tüüp>/<issue-nr>-<lühikirjeldus>`,
  nt `feat/12-color-counting`.
- Commitid järgivad [Angular commit convention](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)'it:
  `feat(core): count unique colors (#12)`.
- `main`-i otse ei pushita – kõik läheb läbi pull requesti.
