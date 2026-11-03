import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { ensureCampaign } from '../domain/campaign.ts'
import { importPackageFromYaml } from '../domain/import/service.ts'
import { getPackageDetail, publishPackage } from '../domain/packages.ts'
import type { TerminalDatabase } from './client.ts'
import { createTerminalDatabase } from './client.ts'
import { importPackageKeys } from './schema.ts'

export const DEMO_PACKAGE_KEY = 'demo-day-one'

/**
 * Day-one 2061 demo content: ship information, a compact official glossary excerpt, Sol and two
 * nearby catalogued systems, one example route. Loaded through the normal import pipeline and
 * published explicitly; marked as demo in its source. Idempotent by package key.
 */
const DEMO_YAML = `version: 1
package:
  key: demo-day-one
  title: Служебный пакет первого дня
  receivedDate: "2061-01-01"
  publicSummary: Служебные сведения о корабле, справочная выдержка и пример картографических записей.
  source: demo
  effectiveDate: "2061-01-01"

categories:
  - key: ship
    name: Корабль
    order: 10
  - key: glossary
    name: Глоссарий
    order: 20

articles:
  - key: ship-information
    category: ship
    title: Сведения о корабле
    body: |
      ## HMS Peregrine

      Военный эскорт проекта ICARUS. Сопровождает тяжёлый экспедиционный транспорт,
      несущий колонистов и оборудование для устройства первого внесолнечного
      метрического якоря.

      Корабельный информационный терминал хранит справочные документы на местных
      носителях. Радиосвязь ограничена скоростью света; срочные документы
      перевозят курьерские корабли.
    relatedArticles:
      - glossary-transition
  - key: glossary-transition
    category: glossary
    title: Переход
    body: |
      Контролируемое перемещение переходной оболочки. Основной технический термин.
      В разговорной речи используется «прыжок».
    relatedArticles:
      - glossary-transition-shell
      - glossary-metric-anchor
  - key: glossary-transition-shell
    category: glossary
    title: Переходная оболочка
    body: |
      Замкнутая область пространства, которая переносится во время Перехода.
      Всё, что полностью попадает внутрь оболочки, совершает Переход вместе
      с кораблём.
  - key: glossary-metric-anchor
    category: glossary
    title: Метрический якорь
    body: |
      Стационарная установка, создающая устойчивую пространственную конфигурацию
      для контролируемого Перехода. Разговорное название — якорь.
  - key: glossary-reckoner
    category: glossary
    title: Считатель
    body: |
      Биологическая вычислительная система. Сложные модели используют живую
      человеческую нервную ткань. Считатель особенно эффективен при работе
      с плохо формализуемыми динамическими системами.

systems:
  - key: sol
    name: Sol
    astronomy:
      designation: "Sol"
      raDegrees: 0
      decDegrees: 0
      distancePc: 0
      spectralType: "G2V"
      catalogSource: Гелиоцентрическая система отсчёта
      epoch: J2000.0
    worldClass: central
    description: Родная система экспедиции.
  - key: alpha-centauri
    name: α Centauri A
    astronomy:
      designation: "* alf Cen A"
      raDegrees: 219.90205833
      decDegrees: -60.83399269
      distancePc: 1.34749
      spectralType: "G2V"
      catalogSource: SIMBAD
      epoch: J2000.0
    worldClass: uncolonized
  - key: proxima
    name: Proxima Centauri
    astronomy:
      designation: "NAME Proxima Centauri"
      raDegrees: 217.42894222
      decDegrees: -62.67949019
      distancePc: 1.30197
      spectralType: "M5.5Ve"
      catalogSource: SIMBAD
      epoch: J2000.0
    worldClass: uncolonized

routes:
  - key: demo-sol-proxima
    from: sol
    to: proxima
    type: experimental
    status: open
    direction: both
    description: Пример картографической записи. Не является утверждённым маршрутом сети.
`

export function runSeed(db: TerminalDatabase): 'seeded' | 'skipped' {
  ensureCampaign(db)
  const existing = db.select().from(importPackageKeys).where(eq(importPackageKeys.key, DEMO_PACKAGE_KEY)).get()
  if (existing) return 'skipped'

  const { packageId } = importPackageFromYaml(db, DEMO_YAML, null, null)
  publishPackage(db, packageId, getPackageDetail(db, packageId).revision)
  return 'seeded'
}

export function runSeedCli(): void {
  const filePath = process.env.DATABASE_PATH ?? './.data/icarus.sqlite'
  const { db, sqlite } = createTerminalDatabase(filePath)
  try {
    const result = runSeed(db)
    console.log(
      result === 'seeded' ? `Seeded ${filePath} with the day-one 2061 demo package` : 'Demo package already present; nothing to do',
    )
  } finally {
    sqlite.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeedCli()
}
