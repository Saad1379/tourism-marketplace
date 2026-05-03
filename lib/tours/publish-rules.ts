export const TOUR_DESCRIPTION_MIN_CHARS = 800
export const GUIDE_BIO_MIN_CHARS = 200
export const MIN_STOPS_FOR_PUBLISH = 4
export const MIN_FUTURE_SCHEDULES_FOR_PUBLISH = 3

export const DESCRIPTION_MIN_MESSAGE =
  "Consider adding more detail (aim for 800+ chars) — longer descriptions typically rank better on Google and convert more bookings."

export const GUIDE_BIO_MIN_MESSAGE =
  "Tell guests a bit more about yourself — detailed bios help build trust and can increase bookings."

export const MIN_STOPS_MESSAGE =
  "Consider adding more stops (aim for 4+) — tours with more details build more traveller confidence."

export const MIN_FUTURE_SCHEDULES_MESSAGE =
  "We recommend adding at least 3 upcoming dates so travellers have more options to book."

export function countFutureSchedules(
  schedules: Array<{ start_time?: string | null; startDate?: string | null; time?: string | null }>,
): number {
  const nowMs = Date.now()
  return schedules.filter((schedule) => {
    if (!schedule) return false
    if (schedule.start_time) {
      const startMs = new Date(schedule.start_time).getTime()
      return Number.isFinite(startMs) && startMs > nowMs
    }

    if (schedule.startDate) {
      const time = schedule.time || "00:00"
      const startMs = new Date(`${schedule.startDate}T${time}`).getTime()
      return Number.isFinite(startMs) && startMs > nowMs
    }

    return false
  }).length
}
