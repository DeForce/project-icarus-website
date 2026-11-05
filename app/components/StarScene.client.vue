<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { MapRouteDto, MapSystemDto } from '../../server/domain/public-dto.ts'
import { equatorialToCartesian } from '../utils/celestial.ts'
import { systemHasCoordinates } from '../utils/map-filter.ts'
import { computeMapScale } from '../utils/map-scale.ts'
import { routeStatusColor, SELECTED_COLOR, worldClassColor } from '../utils/map-style.ts'
import { disposeObjectTree } from '../utils/three-dispose.ts'

const props = defineProps<{
  systems: MapSystemDto[]
  routes: MapRouteDto[]
  selectedId: string | null
  showLabels: boolean
  showGrid: boolean
  showRoutes: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  unsupported: []
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let gridHelper: THREE.GridHelper | null = null
let contentGroup: THREE.Group | null = null
let threeScene: THREE.Scene | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let initialCameraPosition = new THREE.Vector3(0, -6, 4)
const markers = new Map<string, THREE.Mesh>()

const systemPosition = (system: MapSystemDto): THREE.Vector3 | null => {
  if (!systemHasCoordinates(system)) return null
  const { ra, dec, distance } = system.astronomy
  const point = equatorialToCartesian({ raDegrees: ra ?? 0, decDegrees: dec ?? 0, distancePc: distance ?? 0 })
  return new THREE.Vector3(point.x, point.y, point.z)
}

function makeLabel(text: string, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = '600 28px "Consolas", "Lucida Console", monospace'
  let width = 128
  let height = 40
  if (context) {
    context.font = font
    width = Math.ceil(context.measureText(text).width) + 16
  }
  canvas.width = width
  canvas.height = height
  if (context) {
    context.font = font
    context.fillStyle = '#cfe3d0'
    context.textBaseline = 'middle'
    context.fillText(text, 8, height / 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: false, transparent: true }))
  const labelHeight = 0.05
  sprite.scale.set((width / height) * labelHeight, labelHeight, 1)
  sprite.position.copy(position).add(new THREE.Vector3(0, 0, 0.22))
  return sprite
}

function rebuildContent() {
  if (!threeScene) return
  if (contentGroup) {
    threeScene.remove(contentGroup)
    disposeObjectTree(contentGroup)
  }
  contentGroup = new THREE.Group()
  threeScene.add(contentGroup)
  markers.clear()

  const unscaledPositions = new Map<string, THREE.Vector3>()
  for (const system of props.systems) {
    const position = systemPosition(system)
    if (position) unscaledPositions.set(system.id, position)
  }
  let maxLength = 0
  for (const position of unscaledPositions.values()) {
    maxLength = Math.max(maxLength, position.length())
  }
  const scale = computeMapScale(maxLength)
  const positionsById = new Map<string, THREE.Vector3>()
  for (const [id, position] of unscaledPositions) {
    positionsById.set(id, position.multiplyScalar(scale))
  }

  const labelGroup = new THREE.Group()
  for (const system of props.systems) {
    const position = positionsById.get(system.id)
    if (!position) continue
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      new THREE.MeshBasicMaterial({ color: worldClassColor(system.worldClass) }),
    )
    marker.position.copy(position)
    marker.userData.systemId = system.id
    contentGroup.add(marker)
    markers.set(system.id, marker)
    if (props.showLabels) {
      labelGroup.add(makeLabel(system.name, position))
    }
  }
  contentGroup.add(labelGroup)

  if (props.showRoutes) {
    for (const route of props.routes) {
      const from = positionsById.get(route.fromSystemId)
      const to = positionsById.get(route.toSystemId)
      if (!from || !to) continue
      const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: routeStatusColor(route.status) }))
      contentGroup.add(line)
    }
  }

  applySelection()
  if (canvasEl.value) {
    canvasEl.value.dataset.markers = String(markers.size)
  }
}

function applySelection() {
  for (const [id, marker] of markers) {
    const isSelected = id === props.selectedId
    const material = marker.material as THREE.MeshBasicMaterial
    const system = props.systems.find((entry) => entry.id === id)
    material.color.set(isSelected ? SELECTED_COLOR : worldClassColor(system?.worldClass ?? null))
    marker.scale.setScalar(isSelected ? 1.7 : 1)
  }
}

function fitInitialCamera() {
  if (!camera || !controls) return
  const positions = [...markers.values()].map((marker) => marker.position)
  const radius = positions.length ? Math.max(...positions.map((position) => position.length())) : 5
  const distance = Math.max(6, radius * 2.2)
  initialCameraPosition = new THREE.Vector3(0, -distance, distance * 0.6)
  camera.position.copy(initialCameraPosition)
  controls.target.set(0, 0, 0)
  controls.update()
}

function centerOn(id: string) {
  const marker = markers.get(id)
  if (!marker || !camera || !controls) return
  const offset = camera.position.clone().sub(controls.target)
  controls.target.copy(marker.position)
  camera.position.copy(marker.position.clone().add(offset))
  controls.update()
}

function resetView() {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPosition)
  controls.target.set(0, 0, 0)
  controls.update()
}

defineExpose({ centerOn, resetView })

let pointerDown: { x: number; y: number } | null = null

function onPointerDown(event: PointerEvent) {
  pointerDown = { x: event.clientX, y: event.clientY }
}

function onClick(event: MouseEvent) {
  if (!pointerDown || !camera || !canvasEl.value) return
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
  pointerDown = null
  if (moved > 5) return
  const bounds = canvasEl.value.getBoundingClientRect()
  const pointer = new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects([...markers.values()], false)
  const hit = hits[0]?.object
  if (hit) {
    emit('select', hit.userData.systemId as string)
  }
}

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

onMounted(() => {
  if (!webglAvailable() || !canvasEl.value) {
    emit('unsupported')
    return
  }

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value, antialias: true, alpha: true })
  threeScene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000)
  camera.up.set(0, 0, 1)

  gridHelper = new THREE.GridHelper(20, 20, 0x274a2e, 0x1a2f1f)
  gridHelper.rotation.x = Math.PI / 2
  threeScene.add(gridHelper)

  controls = new OrbitControls(camera, canvasEl.value)
  controls.enableDamping = true

  rebuildContent()
  fitInitialCamera()

  const container = canvasEl.value.parentElement
  const resize = () => {
    if (!renderer || !camera || !canvasEl.value?.parentElement) return
    const { clientWidth, clientHeight } = canvasEl.value.parentElement
    if (clientWidth === 0 || clientHeight === 0) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }
  resize()
  if (container) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
  }

  const animate = () => {
    controls?.update()
    if (renderer && threeScene && camera) {
      renderer.render(threeScene, camera)
    }
    animationFrame = requestAnimationFrame(animate)
  }
  animate()

  canvasEl.value.addEventListener('pointerdown', onPointerDown)
  canvasEl.value.addEventListener('click', onClick)
})

watch(() => [props.systems, props.routes, props.showLabels, props.showRoutes], rebuildContent)
watch(
  () => props.showGrid,
  (showGrid) => {
    if (gridHelper) gridHelper.visible = showGrid
  },
)
watch(() => props.selectedId, applySelection)

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  if (canvasEl.value) {
    canvasEl.value.removeEventListener('pointerdown', onPointerDown)
    canvasEl.value.removeEventListener('click', onClick)
  }
  controls?.dispose()
  if (threeScene) {
    disposeObjectTree(threeScene)
  }
  renderer?.dispose()
  renderer = null
  camera = null
  controls = null
  threeScene = null
  contentGroup = null
  gridHelper = null
  markers.clear()
})
</script>

<template>
  <canvas ref="canvasEl" class="star-scene-canvas" data-testid="star-scene" />
</template>
