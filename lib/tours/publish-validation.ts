import {
  DESCRIPTION_MIN_MESSAGE,
  GUIDE_BIO_MIN_CHARS,
  GUIDE_BIO_MIN_MESSAGE,
  MIN_FUTURE_SCHEDULES_FOR_PUBLISH,
  MIN_FUTURE_SCHEDULES_MESSAGE,
  MIN_STOPS_FOR_PUBLISH,
  MIN_STOPS_MESSAGE,
  TOUR_DESCRIPTION_MIN_CHARS,
} from "@/lib/tours/publish-rules"

export type PublishValidationInput = {
  description: string
  guideBio: string
  stopCount: number
  futureScheduleCount: number
}

export function validatePublishRequirements(input: PublishValidationInput): string[] {
  const issues: string[] = []

  const descriptionLength = String(input.description || "").trim().length
  const guideBioLength = String(input.guideBio || "").trim().length
  const stopCount = Number.isFinite(input.stopCount) ? Number(input.stopCount) : 0
  const futureScheduleCount = Number.isFinite(input.futureScheduleCount) ? Number(input.futureScheduleCount) : 0

  if (descriptionLength < TOUR_DESCRIPTION_MIN_CHARS) {
    issues.push(DESCRIPTION_MIN_MESSAGE)
  }

  if (guideBioLength < GUIDE_BIO_MIN_CHARS) {
    issues.push(GUIDE_BIO_MIN_MESSAGE)
  }

  if (stopCount < MIN_STOPS_FOR_PUBLISH) {
    issues.push(MIN_STOPS_MESSAGE)
  }

  if (futureScheduleCount < MIN_FUTURE_SCHEDULES_FOR_PUBLISH) {
    issues.push(MIN_FUTURE_SCHEDULES_MESSAGE)
  }

  return issues
}

