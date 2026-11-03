<script setup lang="ts">
import type { MapRouteDto, MapSystemDto } from '../../server/domain/public-dto.ts'
import StarScene from '../components/StarScene.client.vue'
import { LY_PER_PARSEC } from '../utils/celestial.ts'
import { filterMapData, systemHasCoordinates } from '../utils/map-filter.ts'
import { ROUTE_STATUS_COLORS, WORLD_CLASS_COLORS } from '../utils/map-style.ts'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()

const { data, error } = useFetch('/api/public/map', {
  default: () => ({ systems: [] as MapSystemDto[], routes: [] as MapRouteDto[] }),
})

const worldClass = ref('')
const status = ref('')
const showLabels = ref(true)
const showGrid = ref(true)
const showRoutes = ref(true)
const sceneFailed = ref(false)
const sceneEl = ref<InstanceType<typeof StarScene> | null>(null)

const filtered = computed(() =>
  filterMapData(data.value.systems, data.value.routes, {
    worldClass: worldClass.value || null,
    status: status.value || null,
  }),
)

const worldClassOptions = computed(() => [
  ...new Set(data.value.systems.map((system) => system.worldClass).filter((value): value is string => value !== null)),
])
const statusOptions = computed(() => [
  ...new Set(data.value.routes.map((entry) => entry.status).filter((value): value is string => value !== null)),
])

const selectedId = computed(() => (typeof route.query.system === 'string' ? route.query.system : null))
const selectedSystem = computed(() => data.value.systems.find((system) => system.id === selectedId.value) ?? null)
const selectedVisible = computed(
  () => selectedSystem.value !== null && filtered.value.systems.some((system) => system.id === selectedId.value),
)

function selectSystem(id: string | null) {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') {
      query[key] = value
    }
  }
  if (id) {
    query.system = id
  } else {
    delete query.system
  }
  void router.replace({ query })
}

function centerSelected() {
  if (selectedId.value) {
    sceneEl.value?.centerOn(selectedId.value)
  }
}

function resetView() {
  sceneEl.value?.resetView()
}

const systemName = (id: string) => data.value.systems.find((system) => system.id === id)?.name ?? id
const lightYears = (parsecs: number) => (parsecs * LY_PER_PARSEC).toFixed(2)
const worldClassLabel = (value: string) => (te(`map.worldClassValue.${value}`) ? t(`map.worldClassValue.${value}`) : value)
const routeStatusLabel = (value: string) => (te(`map.routeStatusValue.${value}`) ? t(`map.routeStatusValue.${value}`) : value)
</script>

<template>
  <section class="panel">
    <h1>{{ t('map.heading') }}</h1>
    <p class="terminal-dim">{{ t('map.sceneHint') }}</p>
    <p v-if="error" class="terminal-error">{{ t('error.loadFailed') }}</p>
    <template v-else>
      <div class="map-toolbar">
        <label class="map-filter">
          <span class="terminal-dim">{{ t('map.worldClassFilter') }}</span>
          <select v-model="worldClass" class="terminal-input">
            <option value="">{{ t('map.allOption') }}</option>
            <option v-for="option in worldClassOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label class="map-filter">
          <span class="terminal-dim">{{ t('map.routeStatusFilter') }}</span>
          <select v-model="status" class="terminal-input">
            <option value="">{{ t('map.allOption') }}</option>
            <option v-for="option in statusOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label
          v-for="toggle in [
            { model: showLabels, label: t('map.toggleLabels') },
            { model: showGrid, label: t('map.toggleGrid') },
            { model: showRoutes, label: t('map.toggleRoutes') },
          ]"
          :key="toggle.label"
          class="map-toggle"
        >
          <input v-model="toggle.model" type="checkbox">
          <span>{{ toggle.label }}</span>
        </label>
        <div class="map-toolbar-actions">
          <button
            v-if="selectedSystem && selectedVisible"
            type="button"
            class="terminal-button terminal-button-small"
            :disabled="!systemHasCoordinates(selectedSystem)"
            @click="centerSelected"
          >
            {{ t('map.centerSelection') }}
          </button>
          <button type="button" class="terminal-button terminal-button-small terminal-button-ghost" @click="resetView">
            {{ t('map.resetView') }}
          </button>
        </div>
      </div>

      <div class="map-scene-panel">
        <ClientOnly>
          <StarScene
            v-if="!sceneFailed"
            ref="sceneEl"
            :systems="filtered.systems"
            :routes="filtered.routes"
            :selected-id="selectedVisible ? selectedId : null"
            :show-labels="showLabels"
            :show-grid="showGrid"
            :show-routes="showRoutes"
            @select="selectSystem"
            @unsupported="sceneFailed = true"
          />
          <template #fallback>
            <p class="terminal-dim map-scene-loading">{{ t('map.loadingScene') }}</p>
          </template>
        </ClientOnly>
        <div v-if="sceneFailed" class="map-fallback">
          <p class="terminal-dim">{{ t('map.webglUnavailable') }}</p>
          <ul class="map-list">
            <li v-for="system in filtered.systems" :key="system.id">
              <span class="map-list-name">{{ system.name }}</span>
              <span v-if="systemHasCoordinates(system)" class="terminal-dim">
                RA{{ system.astronomy.ra?.toFixed(4) }}° · Dec{{ system.astronomy.dec?.toFixed(4) }}° ·
                {{ system.astronomy.distance?.toFixed(2) }}
                {{ t('map.parsecs') }}
              </span>
              <span v-else class="terminal-dim">{{ t('map.noCoordinates') }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="map-grid">
        <div>
          <h2>{{ t('map.systems') }}</h2>
          <p v-if="filtered.systems.length === 0" class="terminal-dim">{{ t('map.empty') }}</p>
          <ul class="map-list">
            <li v-for="system in filtered.systems" :key="system.id">
              <button
                type="button"
                class="map-system-entry"
                :class="{ 'is-selected': system.id === selectedId }"
                @click="selectSystem(system.id === selectedId ? null : system.id)"
              >
                <span class="map-list-name">{{ system.name }}</span>
                <span class="terminal-dim">
                  <template v-if="system.astronomy.distance !== null">
                    {{ system.astronomy.distance.toFixed(2) }}
                    {{ t('map.parsecs') }}
                  </template>
                  <template v-if="system.astronomy.spectralType">·{{ system.astronomy.spectralType }}</template>
                  <template v-if="system.faction">·{{ system.faction }}</template>
                  <template v-if="!systemHasCoordinates(system)">·{{ t('map.noCoordinates') }}</template>
                </span>
              </button>
            </li>
          </ul>
          <h2>{{ t('map.legend') }}</h2>
          <ul class="map-legend">
            <li v-for="(color, worldClass) in WORLD_CLASS_COLORS" :key="worldClass">
              <span class="map-swatch" :style="{ backgroundColor: color }" />
              {{ worldClassLabel(worldClass) }}
            </li>
            <li v-for="(color, status) in ROUTE_STATUS_COLORS" :key="status">
              <span class="map-swatch map-swatch-line" :style="{ backgroundColor: color }" />
              {{ routeStatusLabel(status) }}
            </li>
          </ul>
        </div>
        <div>
          <article v-if="selectedSystem" class="map-card">
            <h2>{{ selectedSystem.name }}</h2>
            <dl class="map-card-facts">
              <template v-if="selectedSystem.astronomy.designation">
                <dt>{{ t('map.designation') }}</dt>
                <dd>{{ selectedSystem.astronomy.designation }}</dd>
              </template>
              <template v-if="selectedSystem.astronomy.ra !== null">
                <dt>{{ t('map.rightAscension') }}</dt>
                <dd>{{ selectedSystem.astronomy.ra.toFixed(4) }}° (J2000/ICRS)</dd>
              </template>
              <template v-if="selectedSystem.astronomy.dec !== null">
                <dt>{{ t('map.declination') }}</dt>
                <dd>{{ selectedSystem.astronomy.dec.toFixed(4) }}° (J2000/ICRS)</dd>
              </template>
              <template v-if="selectedSystem.astronomy.distance !== null">
                <dt>{{ t('map.distance') }}</dt>
                <dd>
                  {{ selectedSystem.astronomy.distance.toFixed(2) }}
                  {{ t('map.parsecs') }} ·
                  {{ lightYears(selectedSystem.astronomy.distance) }}
                  {{ t('map.lightYearsUnit') }}
                </dd>
              </template>
              <template v-if="selectedSystem.astronomy.spectralType">
                <dt>{{ t('map.spectralType') }}</dt>
                <dd>{{ selectedSystem.astronomy.spectralType }}</dd>
              </template>
              <template v-if="selectedSystem.astronomy.catalogSource">
                <dt>{{ t('map.catalogSource') }}</dt>
                <dd>{{ selectedSystem.astronomy.catalogSource }}</dd>
              </template>
              <template v-if="selectedSystem.astronomy.epoch">
                <dt>{{ t('map.epoch') }}</dt>
                <dd>{{ selectedSystem.astronomy.epoch }}</dd>
              </template>
              <template v-if="selectedSystem.worldClass">
                <dt>{{ t('map.worldClass') }}</dt>
                <dd>{{ worldClassLabel(selectedSystem.worldClass) }}</dd>
              </template>
              <template v-if="selectedSystem.faction">
                <dt>{{ t('map.faction') }}</dt>
                <dd>{{ selectedSystem.faction }}</dd>
              </template>
              <template v-if="selectedSystem.population !== null">
                <dt>{{ t('map.population') }}</dt>
                <dd>{{ selectedSystem.population }}</dd>
              </template>
              <template v-if="selectedSystem.economy">
                <dt>{{ t('map.economy') }}</dt>
                <dd>{{ selectedSystem.economy }}</dd>
              </template>
              <template v-if="selectedSystem.anchors">
                <dt>{{ t('map.anchors') }}</dt>
                <dd>{{ selectedSystem.anchors }}</dd>
              </template>
            </dl>
            <p v-if="selectedSystem.description">{{ selectedSystem.description }}</p>
            <NuxtLink
              v-if="selectedSystem.articleId"
              :to="`/archive/${selectedSystem.articleId}`"
              class="terminal-button terminal-button-small"
            >
              {{ t('map.openArticle') }}
            </NuxtLink>
            <button type="button" class="terminal-button terminal-button-small terminal-button-ghost" @click="selectSystem(null)">
              {{ t('map.deselect') }}
            </button>
          </article>

          <h2>{{ t('map.routes') }}</h2>
          <p v-if="filtered.routes.length === 0" class="terminal-dim">{{ t('map.empty') }}</p>
          <ul class="map-list">
            <li v-for="routeEntry in filtered.routes" :key="routeEntry.id">
              {{ systemName(routeEntry.fromSystemId) }} →{{ systemName(routeEntry.toSystemId) }}
              <span v-if="routeEntry.type" class="terminal-dim">·{{ routeEntry.type }}</span>
              <span v-if="routeEntry.status" class="terminal-dim">·{{ routeStatusLabel(routeEntry.status) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
