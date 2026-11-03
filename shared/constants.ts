export const MAX_IMPORT_BYTES = 8 * 1024 * 1024

export const MIN_IMPORT_CHANGES = 1

export const MAX_IMPORT_CHANGES = 5000

export const MAX_ARTICLE_BODY_CHARS = 1_000_000

export const MAX_KEY_CHARS = 120

export const MAX_PACKAGE_TITLE_CHARS = 200

/** Stable import key: ASCII letters, digits, `.`, `_`, `-`; first character alphanumeric. */
export const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
