// DEMO ACCOUNTS. These are made-up people for the prototype. Signing in only needs a chosen
// person (no PIN). A real system would use the agency's own sign-in.

export type Role = 'crew' | 'cmo' | 'surgeon'

export interface User {
  id: string
  name: string
  role: Role
  title: string
}

export const USERS: User[] = [
  { id: 'C1', name: 'Tulsi Gandhi', role: 'crew', title: 'Commander' },
  { id: 'C2', name: 'Shayan Akbarloyshabgahi', role: 'cmo', title: 'Crew medical officer' },
  { id: 'C3', name: 'Roya Alizadeh', role: 'crew', title: 'Science specialist' },
  { id: 'C4', name: 'Khamosh Mehta', role: 'crew', title: 'Flight engineer' },
  { id: 'FS', name: 'Flight surgeon', role: 'surgeon', title: 'Mission control, Earth' },
]

/** Who may see whose medical data. Everyone on board sees the whole crew. The flight surgeon on Earth
 *  sees only what the crew sends. */
export function canSee(user: User, crewId: string): boolean {
  return user.role === 'crew' || user.role === 'cmo' || user.id === crewId
}

/** One-way signal delay to Earth for a mission day, in minutes (grows as the ship leaves Earth). */
export function delayMinutes(day: number): number {
  return Math.round(3 + (19 * Math.min(90, Math.max(1, day))) / 90)
}

/** The demo plays the delay 60 times faster: one minute of delay takes one second. */
export const DEMO_MS_PER_DELAY_MINUTE = 1000
