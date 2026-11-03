import { ofetch } from 'ofetch'
import type { ChangeRecord, EntityPayload, PackageInfo } from '~~/shared/types'

export interface AdminPackageDetail extends PackageInfo {
  changes: ChangeRecord[]
}

export interface ChangeDraft {
  entityId: string | undefined
  kind: 'category' | 'article' | 'system' | 'route'
  payload: EntityPayload
}

interface SaveOptions {
  /** Keep local form text after a conflict instead of reloading; the caller shows a reload banner. */
  keepTextOnConflict?: boolean
}

/**
 * Owns one draft's server state and the revision protocol: every write carries
 * `expectedPackageRevision`; a 409 flips `conflict` and, by default, reloads the server state
 * while forms keep their own text (forms own their baselines independently).
 */
export function usePackageEditor(packageId: string) {
  const detail = ref<AdminPackageDetail | null>(null)
  const loadError = ref(false)
  const saving = ref(false)
  const conflict = ref(false)
  const publicationProblems = ref<Array<{ path: string; message: string }>>([])

  const isDraft = computed(() => detail.value?.status === 'draft')
  const revision = computed(() => detail.value?.revision ?? 0)

  // Typed as plain strings on purpose: Nitro's route-type inference recurses deeply
  // on template literals with dynamic params and blows the type-checker stack.
  const packageUrl: string = `/api/admin/packages/${packageId}`
  const changesUrl: string = `${packageUrl}/changes`

  async function load(): Promise<void> {
    try {
      detail.value = await $fetch<AdminPackageDetail>(packageUrl)
      loadError.value = false
    } catch {
      loadError.value = true
    }
  }

  async function run<T>(action: (revision: number) => Promise<T>, options: SaveOptions = {}): Promise<T | undefined> {
    saving.value = true
    conflict.value = false
    try {
      const result = await action(revision.value)
      await load()
      return result
    } catch (error) {
      if (isConflict(error)) {
        conflict.value = true
        if (!options.keepTextOnConflict) await load()
        return undefined
      }
      throw error
    } finally {
      saving.value = false
    }
  }

  function isConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 409
  }

  async function saveMetadata(fields: { title: string; receivedDate: string; publicSummary: string | null }) {
    return run((revision) =>
      ofetch(packageUrl, {
        method: 'PUT',
        body: { expectedPackageRevision: revision, ...fields },
      }),
    )
  }

  async function saveChange(draft: ChangeDraft) {
    return run((revision) =>
      ofetch(changesUrl, {
        method: 'POST',
        body: {
          expectedPackageRevision: revision,
          entityId: draft.entityId,
          kind: draft.kind,
          payload: draft.payload,
        },
      }),
    )
  }

  async function cancelChange(entityId: string) {
    const url: string = `${changesUrl}/${entityId}`
    return run((revision) =>
      ofetch(url, {
        method: 'DELETE',
        body: { expectedPackageRevision: revision },
      }),
    )
  }

  async function deleteDraft() {
    return run((revision) =>
      ofetch(packageUrl, {
        method: 'DELETE',
        body: { expectedPackageRevision: revision },
      }),
    )
  }

  async function checkReferences(): Promise<Array<{ path: string; message: string }>> {
    const result = await $fetch<{ problems: Array<{ path: string; message: string }> }>(`${packageUrl}/preview`, {
      method: 'POST',
      body: {},
    })
    return result.problems
  }

  async function publish(): Promise<boolean> {
    publicationProblems.value = []
    const result = await run(
      (revision) =>
        ofetch(`${packageUrl}/publish`, {
          method: 'POST',
          body: { expectedPackageRevision: revision },
        }),
      { keepTextOnConflict: true },
    )
    return result !== undefined
  }

  async function capturePublicationError(error: unknown): Promise<void> {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 422) {
      const data = (error as { data?: { problems?: Array<{ path: string; message: string }> } }).data
      publicationProblems.value = data?.problems ?? []
    }
  }

  return {
    detail,
    loadError,
    saving,
    conflict,
    isDraft,
    revision,
    publicationProblems,
    load,
    saveMetadata,
    saveChange,
    cancelChange,
    deleteDraft,
    checkReferences,
    publish,
    capturePublicationError,
  }
}
