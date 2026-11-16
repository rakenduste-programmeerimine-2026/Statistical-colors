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

## Töövoog

- Iga töö algab **issue'st**. Branchi nimi: `<tüüp>/<issue-nr>-<lühikirjeldus>`,
  nt `feat/12-color-counting`.
- Commitid järgivad [Angular commit convention](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)'it:
  `feat(core): count unique colors (#12)`.
- `main`-i otse ei pushita – kõik läheb läbi pull requesti.
