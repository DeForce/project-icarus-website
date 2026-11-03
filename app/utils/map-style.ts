/** Scene palette shared by the Three.js scene and the page legend. */
export const WORLD_CLASS_COLORS: Record<string, string> = {
  central: '#e8a33d',
  uncolonized: '#8fae91',
}

export const DEFAULT_SYSTEM_COLOR = '#cfe3d0'

export const ROUTE_STATUS_COLORS: Record<string, string> = {
  open: '#e8a33d',
  suspended: '#d9534f',
}

export const DEFAULT_ROUTE_COLOR = '#8fae91'

export const SELECTED_COLOR = '#e8a33d'

export const worldClassColor = (worldClass: string | null): string => (worldClass && WORLD_CLASS_COLORS[worldClass]) || DEFAULT_SYSTEM_COLOR

export const routeStatusColor = (status: string | null): string => (status && ROUTE_STATUS_COLORS[status]) || DEFAULT_ROUTE_COLOR
