import type { BufferGeometry, Material, Object3D, Texture } from 'three'

type DisposableObject = Object3D & {
  geometry?: BufferGeometry
  material?: Material | Material[]
}

function disposeMaterial(material: Material & { map?: Texture | null }) {
  material.map?.dispose()
  material.dispose()
}

/** Disposes geometries, materials and label textures of every node in the tree, including nested groups. */
export function disposeObjectTree(root: Object3D): void {
  root.traverse((node) => {
    const object = node as DisposableObject
    object.geometry?.dispose()
    const material = object.material
    if (Array.isArray(material)) {
      for (const entry of material) {
        disposeMaterial(entry)
      }
    } else if (material) {
      disposeMaterial(material)
    }
  })
}
