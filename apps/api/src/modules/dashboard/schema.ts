import { z } from 'zod'

export const dashboardSchemas = {
    statsQuery: z.object({
        clinicId: z.string().optional(),
    }),
}
