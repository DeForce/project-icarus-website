import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getPackageDetail } from '../../../domain/packages.ts'
import { getTerminal } from '../../../utils/terminal-db.ts'

export default defineEventHandler((event) => {
  const packageId = getRouterParam(event, 'id')
  if (!packageId) throw createError({ statusCode: 400, statusMessage: 'Missing package id' })
  const { db } = getTerminal()
  try {
    return getPackageDetail(db, packageId)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Package not found' })
  }
})
