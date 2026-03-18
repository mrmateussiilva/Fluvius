import { Role } from '../enums/roles.js'

export type UserResponse = {
    id: string
    clinicId: string
    name: string
    email: string
    role: Role
    createdAt: Date | string
}

export type AttendantStatsResponse = UserResponse & {
    online: boolean
    activeChats: number
    leadsToday: number
    closedToday: number
    averageResponseTime: string
    tags: string[]
    lastUpdate: string
}
