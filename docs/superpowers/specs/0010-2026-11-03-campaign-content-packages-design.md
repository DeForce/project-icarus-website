# 0010 — Campaign Content Packages

Status: Draft.
Date: 2026-11-03.

## Intent

Load the ICARUS terminal with the campaign's real starting content: the Imperial chronicle, reference works, the Project Icarus dossier and the astrographic registry, authored as YAML v1 packages in `content/` and imported through the normal import workflow. Priorities set by the owner: the history up to year-one 2061 and the Project Icarus plans come first; future packages are secondary.

## Voice and access rules

- **Readers are characters only.** Every document is written in-world: the author is a British Imperial bureaucrat, historian or official living in 2061 — official, technical, conservative register, no meta commentary, no out-of-game references.
- **Inclusion criterion** ("доступная информация"): content available to any Imperial citizen with network access, plus material cleared for Project Icarus personnel.
- **Owner review gates**: the reduced lexicon and each finished package are shown to the owner before import; anything flagged uncertain is asked about, never guessed in.
- Obsidian stays read-only reference; the YAML packages in `content/` become the terminal's editable source of truth.

## Exclusions

- Player character dossiers (`obsidian/Игроки/*`) — personal files, not crew-wide information.
- `Развитие Истории до появления игроков.md` and `1. Сюжет/1. Прилет.md` — GM planning.
- `Style Guidance.md` — meta writing aid.
- Registry section IV (editorial draft 2061–2146, marked by its own author as not for the crew dossier) and the out-of-game source note.
- Multimedia — the terminal carries text only.

A secrecy scan of the included corpus found no unpublished secret developments: the chronicle's two secrecy mentions are public knowledge about secrets (the Martian Галлеит secret, generic disclosure law), not secret content.

## Package set (first week of 2061)

YAML v1 files in `content/`, one per package, stable per-kind keys (`history-*`, `ref-*`, `icarus-*`, `tech-*`, `astro-*`). The demo seed package (Sol, α Cen, Proxima, demo route) stays published as the map foundation.

| File                           | receivedDate | Content                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/history-imperial.yml` | 2061-01-01   | Category «История Империи», 8 articles — one per major section of «Предыстория Общая» (general chronicle 1774–2061, firearms, religion, narcotics and military pharmacology, military law, slavery and labour law, monarchy and parliament, information networks) |
| `content/reference-works.yml`  | 2061-01-02   | Category «Справочник»: 12 glossary articles, «Английские дома», «Офицеры Имперского флота», «Нижние чины и старшины», reduced «Флотский словарь»                                                                                                                  |
| `content/project-icarus.yml`   | 2061-01-03   | Category «Проект Икар»: «Проект ICARUS — состояние на 2061 год» (registry §III), «HMS Peregrine» (Корабли §10), article «Система Сол» (registry §I)                                                                                                               |
| `content/astro-registry.yml`   | 2061-01-04   | Category «Астрографический реестр»: «Система LHS 1140» (registry §II); system entities Sol (key `sol`, supersedes demo data with full astronomy and description) and LHS 1140; route «Маршрут ICARUS» Sol → LHS 1140                                              |
| `content/technical-works.yml`  | 2061-01-05   | Category «Технические описания»: Считатели, Галлиетовые щиты и оружие, двигательные системы (Корабли §1–9), планетарное сообщение                                                                                                                                 |

## Lexicon reduction

«Флотский словарь» includes only lexicon terms attested in the converted corpus: extract candidate terms from `obsidian/История/Лексикон.md`, mechanically keep those occurring in the other converted texts (case-insensitive word-boundary match), keep the lexicon's own structure for the survivors. The reduced article is shown to the owner for approval before import; the owner flags entries that are wrong or not-yet-canonical even when attested.

## Astronomy

System astronomy is real catalogue data: LHS 1140 coordinates and parameters come from the SIMBAD TAP query via the existing dev script `scripts/fetch-star.mjs` (dev-only, results committed into the YAML); Sol keeps the demo values. No invented astronomy.

## Conversion rules

- Article bodies keep the source structure (headings, tables, lists); Obsidian wiki-links do not occur in the included corpus, so no link rewriting is needed.
- In-world register is preserved verbatim where the source already speaks as an official document (the registry is a finished in-world text and converts nearly as-is); chronicle sections get neutral archival titles and the standard reference framing.
- Related articles: set `relatedArticles` links inside each package where the source text clearly couples entries (e.g. glossary ↔ chronicle terms, Peregrine ↔ engines); keep links within-package to avoid cross-package reference churn.
- Each package carries a `source` naming its in-world issuing body (e.g. «Имперское астрографическое управление») and an in-world `publicSummary`.

## Verification

- YAML validity and import preconditions checked through the admin preview endpoint before any import; imports happen only after owner approval of the reduced lexicon and a spot review.
- After import and publication: public archive renders the new categories and articles at desktop and phone widths; the map shows Sol and LHS 1140 with the ICARUS route; drafts remain private until published; the demo package content is superseded where keys overlap (`sol`).
- Remaining owner step: advance the campaign date past 2061-01-05 (or publish at later dates) as usual — no terminal changes needed.
