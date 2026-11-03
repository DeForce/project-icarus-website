import { defineEventHandler } from 'h3'
import { listPackages } from '../../../domain/packages.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

export default defineEventHandler(() => {
  const { db } = getTerminal()
  return listPackages(db)
})
