<script setup lang="ts">
import type { ChangeDraft } from '~/composables/usePackageEditor'
import type { ArticlePayload, CategoryPayload, RoutePayload, SystemPayload } from '~~/shared/types'

interface Option {
  id: string
  name: string
}

const props = defineProps<{
  /** null means a new change: the kind picker stays enabled. */
  initial: ChangeDraft | null
  options: { categories: Option[]; articles: Option[]; systems: Option[] }
  saving: boolean
  resetSignal: number
}>()

const emit = defineEmits<{
  save: [draft: ChangeDraft]
  close: []
}>()

const { t } = useI18n()

/** Documented spectral classes: main sequence (O–M), Wolf–Rayet (W), carbon (C, S), brown dwarfs (L, T, Y), white dwarfs (D). */
const SPECTRAL_CLASSES = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'W', 'C', 'S', 'L', 'T', 'Y', 'D']

type Kind = ChangeDraft['kind']
const kinds: Kind[] = ['category', 'article', 'system', 'route']

const kind = ref<Kind>(props.initial?.kind ?? 'category')

const category = ref({ name: '', parentId: null as string | null, order: 0 })
const article = ref({ title: '', categoryId: '', bodyMarkdown: '', relatedArticleIds: [] as string[] })
const system = ref({
  name: '',
  astronomy: {
    designation: '',
    ra: null as number | null,
    dec: null as number | null,
    distance: null as number | null,
    spectralType: '',
    catalogSource: '',
    epoch: '',
  },
  faction: '',
  worldClass: 'unknown',
  population: null as number | null,
  economy: '',
  anchors: '',
  description: '',
  articleId: null as string | null,
})
const route = ref({
  fromSystemId: '',
  toSystemId: '',
  type: 'secondary',
  status: 'unknown',
  direction: 'both',
  operator: '',
  minimumJumpOrder: null as number | null,
  description: '',
  articleId: null as string | null,
})

function nullableNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableInt(value: string): number | null {
  const parsed = nullableNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function emptyAstronomy(systemPayload: {
  designation: string | null
  ra: number | null
  dec: number | null
  distance: number | null
  spectralType: string | null
  catalogSource: string | null
  epoch: string | null
}) {
  return {
    designation: systemPayload.designation ?? '',
    ra: systemPayload.ra,
    dec: systemPayload.dec,
    distance: systemPayload.distance,
    spectralType: systemPayload.spectralType ?? '',
    catalogSource: systemPayload.catalogSource ?? '',
    epoch: systemPayload.epoch ?? '',
  }
}

// Adopt the edited change; resetSignal re-syncs after a deliberate reload.
function syncFromInitial() {
  const initial = props.initial
  if (!initial?.payload) return
  kind.value = initial.kind
  if (initial.kind === 'category') {
    const payload = initial.payload as CategoryPayload
    category.value = { name: payload.name, parentId: payload.parentId, order: payload.order }
  }
  if (initial.kind === 'article') {
    const payload = initial.payload as ArticlePayload
    article.value = {
      title: payload.title,
      categoryId: payload.categoryId,
      bodyMarkdown: payload.bodyMarkdown,
      relatedArticleIds: [...payload.relatedArticleIds],
    }
  }
  if (initial.kind === 'system') {
    const payload = initial.payload as SystemPayload
    system.value = {
      name: payload.name,
      astronomy: emptyAstronomy(payload.astronomy),
      faction: payload.faction ?? '',
      worldClass: payload.worldClass ?? 'unknown',
      population: payload.population,
      economy: payload.economy ?? '',
      anchors: payload.anchors ?? '',
      description: payload.description,
      articleId: payload.articleId,
    }
  }
  if (initial.kind === 'route') {
    const payload = initial.payload as RoutePayload
    route.value = {
      ...payload,
      type: payload.type ?? 'secondary',
      status: payload.status ?? 'unknown',
      direction: payload.direction ?? 'both',
      operator: payload.operator ?? '',
    }
  }
}

watch(() => props.resetSignal, syncFromInitial)

function submit() {
  let payload: ChangeDraft['payload']
  if (kind.value === 'category') payload = { ...category.value }
  else if (kind.value === 'article') payload = { ...article.value, relatedArticleIds: [...article.value.relatedArticleIds] }
  else if (kind.value === 'system') {
    payload = {
      ...system.value,
      astronomy: {
        designation: system.value.astronomy.designation || null,
        ra: system.value.astronomy.ra,
        dec: system.value.astronomy.dec,
        distance: system.value.astronomy.distance,
        spectralType: system.value.astronomy.spectralType || null,
        catalogSource: system.value.astronomy.catalogSource || null,
        epoch: system.value.astronomy.epoch || null,
      },
      faction: system.value.faction || null,
      economy: system.value.economy || null,
      anchors: system.value.anchors || null,
    }
  } else {
    payload = { ...route.value, operator: route.value.operator || null }
  }
  emit('save', { entityId: props.initial?.entityId, kind: kind.value, payload })
}

onMounted(syncFromInitial)
</script>

<template>
  <form class="terminal-form form-wide change-editor" @submit.prevent="submit">
    <label>
      {{ t(`editor.kind.${initial ? initial.kind : kind}`) }}
      <select v-if="!initial" v-model="kind" class="terminal-input" :disabled="saving">
        <option v-for="option in kinds" :key="option" :value="option">{{ t(`editor.kind.${option}`) }}</option>
      </select>
    </label>

    <template v-if="kind === 'category'">
      <label>
        {{ t('editor.field.name') }}
        <input v-model="category.name" type="text" class="terminal-input" required :disabled="saving">
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.parent') }}</span>
        <AdminEntityPicker v-model="category.parentId" :options="options.categories" nullable :disabled="saving" />
      </div>
      <label>
        {{ t('editor.field.order') }}
        <input v-model="category.order" type="number" step="1" class="terminal-input" :disabled="saving">
      </label>
    </template>

    <template v-else-if="kind === 'article'">
      <label>
        {{ t('editor.field.title') }}
        <input v-model="article.title" type="text" class="terminal-input" required :disabled="saving">
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.category') }}</span>
        <AdminEntityPicker v-model="article.categoryId" :options="options.categories" :disabled="saving" />
      </div>
      <label>
        {{ t('editor.field.body') }}
        <textarea v-model="article.bodyMarkdown" class="terminal-input terminal-textarea" rows="10" required :disabled="saving" />
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.relatedArticles') }}</span>
        <AdminEntityPicker v-model="article.relatedArticleIds" :options="options.articles" multiple :disabled="saving" />
      </div>
    </template>

    <template v-else-if="kind === 'system'">
      <label>
        {{ t('editor.field.name') }}
        <input v-model="system.name" type="text" class="terminal-input" required :disabled="saving">
      </label>
      <fieldset class="checkbox-group">
        <legend>{{ t('editor.field.astronomy') }}</legend>
        <label>
          {{ t('editor.field.designation') }}
          <input v-model="system.astronomy.designation" type="text" class="terminal-input" :disabled="saving">
        </label>
        <label>
          {{ t('editor.field.ra') }}
          <input
            :value="system.astronomy.ra ?? ''"
            type="number"
            step="any"
            min="0"
            max="360"
            class="terminal-input"
            :disabled="saving"
            @input="system.astronomy.ra = nullableNumber(($event.target as HTMLInputElement).value)"
          >
        </label>
        <label>
          {{ t('editor.field.dec') }}
          <input
            :value="system.astronomy.dec ?? ''"
            type="number"
            step="any"
            min="-90"
            max="90"
            class="terminal-input"
            :disabled="saving"
            @input="system.astronomy.dec = nullableNumber(($event.target as HTMLInputElement).value)"
          >
        </label>
        <label>
          {{ t('editor.field.distance') }}
          <input
            :value="system.astronomy.distance ?? ''"
            type="number"
            step="any"
            min="0"
            class="terminal-input"
            :disabled="saving"
            @input="system.astronomy.distance = nullableNumber(($event.target as HTMLInputElement).value)"
          >
        </label>
        <label>
          {{ t('editor.field.spectralType') }}
          <input
            v-model="system.astronomy.spectralType"
            list="spectral-class-options"
            type="text"
            class="terminal-input"
            :disabled="saving"
          >
          <datalist id="spectral-class-options">
            <option v-for="spectralClass in SPECTRAL_CLASSES" :key="spectralClass" :value="spectralClass" />
          </datalist>
        </label>
        <label>
          {{ t('editor.field.catalogSource') }}
          <input v-model="system.astronomy.catalogSource" type="text" class="terminal-input" :disabled="saving">
        </label>
        <label>
          {{ t('editor.field.epoch') }}
          <input v-model="system.astronomy.epoch" type="text" class="terminal-input" :disabled="saving">
        </label>
      </fieldset>
      <label>
        {{ t('editor.field.faction') }}
        <input v-model="system.faction" type="text" class="terminal-input" :disabled="saving">
      </label>
      <label>
        {{ t('editor.field.worldClass') }}
        <select v-model="system.worldClass" class="terminal-input" :disabled="saving">
          <option v-for="option in ['central', 'middle', 'outer', 'uncolonized', 'unknown']" :key="option" :value="option">
            {{ t(`editor.worldClass.${option}`) }}
          </option>
        </select>
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.population') }}</span>
        <AdminGroupedNumberInput v-model="system.population" :disabled="saving" />
      </div>
      <label>
        {{ t('editor.field.economy') }}
        <input v-model="system.economy" type="text" class="terminal-input" :disabled="saving">
      </label>
      <label>
        {{ t('editor.field.anchors') }}
        <input v-model="system.anchors" type="text" class="terminal-input" :disabled="saving">
      </label>
      <label>
        {{ t('editor.field.description') }}
        <textarea v-model="system.description" class="terminal-input terminal-textarea" rows="4" :disabled="saving" />
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.article') }}</span>
        <AdminEntityPicker v-model="system.articleId" :options="options.articles" nullable :disabled="saving" />
      </div>
    </template>

    <template v-else>
      <div class="field">
        <span class="field-label">{{ t('editor.field.from') }}</span>
        <AdminEntityPicker v-model="route.fromSystemId" :options="options.systems" :disabled="saving" />
      </div>
      <div class="field">
        <span class="field-label">{{ t('editor.field.to') }}</span>
        <AdminEntityPicker v-model="route.toSystemId" :options="options.systems" :disabled="saving" />
      </div>
      <label>
        {{ t('editor.field.type') }}
        <select v-model="route.type" class="terminal-input" :disabled="saving">
          <option v-for="option in ['main', 'secondary', 'experimental', 'historical']" :key="option" :value="option">
            {{ t(`editor.routeType.${option}`) }}
          </option>
        </select>
      </label>
      <label>
        {{ t('editor.field.status') }}
        <select v-model="route.status" class="terminal-input" :disabled="saving">
          <option v-for="option in ['open', 'closed', 'dangerous', 'unknown']" :key="option" :value="option">
            {{ t(`editor.routeStatus.${option}`) }}
          </option>
        </select>
      </label>
      <label>
        {{ t('editor.field.direction') }}
        <select v-model="route.direction" class="terminal-input" :disabled="saving">
          <option v-for="option in ['both', 'forward']" :key="option" :value="option">
            {{ t(`editor.routeDirection.${option}`) }}
          </option>
        </select>
      </label>
      <label>
        {{ t('editor.field.operator') }}
        <input v-model="route.operator" type="text" class="terminal-input" :disabled="saving">
      </label>
      <label>
        {{ t('editor.field.minimumJumpOrder') }}
        <input
          :value="route.minimumJumpOrder ?? ''"
          type="number"
          step="1"
          min="0"
          class="terminal-input"
          :disabled="saving"
          @input="route.minimumJumpOrder = nullableInt(($event.target as HTMLInputElement).value)"
        >
      </label>
      <label>
        {{ t('editor.field.description') }}
        <textarea v-model="route.description" class="terminal-input terminal-textarea" rows="4" :disabled="saving" />
      </label>
      <div class="field">
        <span class="field-label">{{ t('editor.field.article') }}</span>
        <AdminEntityPicker v-model="route.articleId" :options="options.articles" nullable :disabled="saving" />
      </div>
    </template>

    <div class="form-actions">
      <button type="submit" class="terminal-button" :disabled="saving">{{ t('editor.save') }}</button>
      <button type="button" class="terminal-button terminal-button-ghost" :disabled="saving" @click="emit('close')">
        {{ t('editor.discard') }}
      </button>
    </div>
  </form>
</template>
