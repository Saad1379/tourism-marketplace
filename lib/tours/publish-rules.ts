export const TOUR_DESCRIPTION_MIN_CHARS = 800
export const GUIDE_BIO_MIN_CHARS = 200
export const MIN_STOPS_FOR_PUBLISH = 4
export const MIN_FUTURE_SCHEDULES_FOR_PUBLISH = 3

export const DESCRIPTION_MIN_MESSAGE =
  "Add more detail — aim for at least 150 words. Longer descriptions rank better on Google and convert more bookings."

export const GUIDE_BIO_MIN_MESSAGE =
  "Tell guests a bit more about yourself — guides with detailed bios get significantly more bookings."

export const MIN_STOPS_MESSAGE =
  "Add at least 4 stops — tours with more stops rank better and build more traveller confidence."

export const MIN_FUTURE_SCHEDULES_MESSAGE =
  "Add at least 3 upcoming dates so travellers can book."

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
