type ServerCapturePayload = {
  event: string
  distinctId: string
  insertId?: string
  properties?: Record<string, unknown>
}

const DEFAULT_POSTHOG_HOST = "https://eu.posthog.com"

function getIngestionHost(baseHost: string) {
  try {
    const url = new URL(baseHost)

    if (url.hostname === "eu.posthog.com") {
      url.hostname = "eu.i.posthog.com"
    } else if (url.hostname === "us.posthog.com") {
      url.hostname = "us.i.posthog.com"
    } else if (!url.hostname.includes(".i.")) {
      url.hostname = `i.${url.hostname}`
    }

    return `${url.protocol}//${url.hostname}`
  } catch {
    return "https://eu.i.posthog.com"
  }
}

export async function capturePostHogServerEvent(payload: ServerCapturePayload) {
  const projectApiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!projectApiKey) return

  const baseHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST
  const captureHost = getIngestionHost(baseHost)

  const body = {
    api_key: projectApiKey,
    event: payload.event,
    distinct_id: payload.distinctId,
    properties: {
      ...payload.properties,
      ...(payload.insertId ? { $insert_id: payload.insertId } : {}),
      $source: "tipwalk-server",
    },
  }

  try {
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), 1500)

    const response = await fetch(`${captureHost}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: timeoutController.signal,
      keepalive: true,
    })

    clearTimeout(timeoutId)

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.warn("[v0] PostHog server capture failed:", response.status)
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[v0] PostHog server capture error:", error)
    }
  }
}
