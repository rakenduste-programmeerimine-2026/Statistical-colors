// Short Estonian explanations of the colour terms the pages use (P-038: "the
// user does not know colour science"). Shown by the Term component.

export const GLOSSARY = {
  srgb: "sRGB on tavaline ekraanide värviruum: iga värv on kolm arvu 0–255 (punane, roheline, sinine).",
  hex: "Kuueteistkümnendkoodis värv, nt #FF0000 on punane: kaks märki iga kanali kohta.",
  oklch: "OKLCH kirjeldab värvi nii, nagu silm seda tajub: heledus L, küllus C ja toon h. Võrdne arvuline vahe tähendab ligikaudu võrdset nähtavat vahet.",
  oklab: "OKLab on OKLCH-ga sama ruum ristkoordinaatides: L heledus, a roheline–punane, b sinine–kollane telg.",
  cielab: "CIELAB (L*, a*, b*) on vanem rahvusvaheline tajupõhine värviruum, mida kasutatakse värvimõõtmises ja trükis.",
  lightness: "Heledus (L): kui hele värv tundub, mustast (0) valgeni (1 või 100).",
  chroma: "Kroom ehk küllus (C): kui kaugel värv hallist on. 0 on hall, suurem arv on erksam värv.",
  hue: "Toon (h): värvi asukoht värviringil kraadides, nt 0° punakas, 120° roheline, 240° sinine.",
  deltaE: "ΔE (delta E): kahe värvi nähtav erinevus. OKLab-is on umbes 0,02 vahe veel just märgatav.",
  jnd: "Just märgatav erinevus (JND): väikseim värvivahe, mida inimene katses veel eristab.",
  gamut: "Gamut: kõik värvid, mida värviruum (siin sRGB) suudab näidata.",
  cluster: "Klaster: rühm peaaegu sama värvi toone, mis loetakse üheks värviks (vahe alla ühe JND).",
  blend: "Segupiksel: värv, mis tekib kahe värvi piirile servade silumisel. Seda ei valinud keegi.",
  blendSimilarity:
    "Segupiksli sarnasus näitab, kui täpselt see haruldane värv jääb kahe sagedase värvi vahelisele sirgele sRGB-s: 100 % = täpselt sirgel, 50 % = 6 väärtuse kaugusel, 0 % = kaugemal või pole harv. See on sarnasus, mitte tõenäosus.",
  harmony: "Värviharmoonia: värvid, mille toonid asuvad värviringil reeglipäraselt, nt vastas (vastandvärvid) või 120° kaugusel (kolmik).",
  contrast: "WCAG kontrast: teksti ja tausta heleduse suhe 1–21. Tavateksti miinimum on 4,5 : 1.",
  share: "Osakaal: mitu protsenti pildi pikslitest on selle värviga.",
  uniqueColors: "Unikaalsed värvid: mitu erinevat täpset värvikoodi pildis on.",
  topN: "Mitu sagedasemat värvi tabelis näidatakse. Kokkuvõtte CSV sisaldab alati kõiki värve.",
  confidence: "Kindlus näitab, kui palju tulemust tõendid toetavad. See on hinnang, mitte tõenäosus ega tõestus.",
  coverage: "Katvus: mitu protsenti kõigist sRGB värvidest pildi värvid hõlmavad, kui värviruum on jagatud just märgatavateks rakkudeks.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
