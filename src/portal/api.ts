import { createApiClient } from '@wasichai/core'

// el mismo baseUrl y el mismo storagePrefix que /admin: el token con el que se entra en uno sirve en el otro (sgspe.token)
export const client = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
