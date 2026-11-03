import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { disposeObjectTree } from './three-dispose.ts'

describe('disposeObjectTree', () => {
  it('disposes geometries, materials and textures throughout nested groups', () => {
    const disposals = { geometries: 0, materials: 0, textures: 0 }
    const trackDispose = (target: THREE.BufferGeometry | THREE.Material | THREE.Texture, counter: keyof typeof disposals) => {
      target.addEventListener('dispose', () => {
        disposals[counter] += 1
      })
    }

    const markerGeometry = new THREE.SphereGeometry(1)
    trackDispose(markerGeometry, 'geometries')
    const markerMaterial = new THREE.MeshBasicMaterial()
    trackDispose(markerMaterial, 'materials')
    const marker = new THREE.Mesh(markerGeometry, markerMaterial)

    const labelTexture = new THREE.Texture()
    trackDispose(labelTexture, 'textures')
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture })
    trackDispose(labelMaterial, 'materials')
    const labelGroup = new THREE.Group()
    labelGroup.add(new THREE.Sprite(labelMaterial), new THREE.Sprite(labelMaterial.clone()))

    const routeGeometry = new THREE.BufferGeometry()
    trackDispose(routeGeometry, 'geometries')
    const routeMaterial = new THREE.LineBasicMaterial()
    trackDispose(routeMaterial, 'materials')
    const route = new THREE.Line(routeGeometry, routeMaterial)

    const grid = new THREE.GridHelper(10, 10)
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    for (const material of gridMaterials) {
      trackDispose(material, 'materials')
    }
    trackDispose(grid.geometry, 'geometries')

    const root = new THREE.Group()
    root.add(marker, labelGroup, route, grid)

    disposeObjectTree(root)

    expect(disposals.geometries).toBe(3)
    expect(disposals.materials).toBe(3 + gridMaterials.length)
    // the cloned sprite material shares the same texture, so it is disposed once per owning material
    expect(disposals.textures).toBe(2)
  })

  it('handles an empty group', () => {
    expect(() => disposeObjectTree(new THREE.Group())).not.toThrow()
  })
})
