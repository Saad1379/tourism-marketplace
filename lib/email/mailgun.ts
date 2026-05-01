import FormData from "form-data"
import Mailgun from "mailgun.js"
import { getPlatformGoogleReviewUrl, getPlatformTrustpilotReviewUrl } from "@/lib/review-qr"

const MAILGUN_DOMAIN = "mail.touricho.com"
const FROM_BOOKING = "Touricho <booking@mail.touricho.com>"
const FROM_SUPPORT = "Touricho <support@mail.touricho.com>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://touricho.com"
const DEFAULT_GOOGLE_REVIEW_URL = "https://g.page/r/CXcrrcfFl5YNEAE/review"
const DEFAULT_TRUSTPILOT_REVIEW_URL = "https://www.touricho.com/rt/f99e4c9eeff4c582d5e84f31e321e88e8450b98949434ee7"

function getClient() {
  const mailgun = new Mailgun(FormData)
  return mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "",
    url: "https://api.eu.mailgun.net",
  })
}

// ─── Generic send helper ────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

export async function sendEmail({ to, subject, html, text, from = FROM_SUPPORT }: SendEmailOptions) {
  const mg = getClient()
  const recipients = Array.isArray(to) ? to : [to]

  await mg.messages.create(MAILGUN_DOMAIN, {
    from,
    to: recipients,
    subject,
    html,
    ...(text ? { text } : {}),
  })
}

// ─── Guide approval email ────────────────────────────────────────────────────

export async function sendGuideApprovalEmail(guideName: string, guideEmail: string) {
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#16a34a;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">You've Been Approved as a Guide!</h1>
  </div>
  <div style="padding:24px;background:#f9fafb;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
    <p style="margin:0 0 16px">Hi <strong>${guideName}</strong>,</p>
    <p style="margin:0 0 16px">
      Congratulations! Your application to become a guide on <strong>Touricho</strong> has been
      <strong style="color:#16a34a">approved</strong>. Welcome to our community of local experts!
    </p>
    <p style="margin:0 0 24px">
      You can now log in to your account, set up your profile, and start creating tours for travelers from around the world.
    </p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${APP_URL}/login"
        style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:15px;font-weight:600">
        Log In &amp; Start Guiding
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px" />
    <p style="margin:0;font-size:13px;color:#6b7280">
      If you have any questions, reply to this email or contact us at
      <a href="mailto:support@mail.touricho.com" style="color:#16a34a">support@mail.touricho.com</a>.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:#6b7280">
      See you on the road,<br><strong>The Touricho Team</strong>
    </p>
  </div>
</div>`

  const text = `Hi ${guideName},

Congratulations! Your application to become a guide on Touricho has been approved.

You can now log in and start setting up your tours:
${APP_URL}/login

If you have any questions, contact us at support@mail.touricho.com.

See you on the road,
The Touricho Team`

  await sendEmail({
    to: `${guideName} <${guideEmail}>`,
    subject: "Your Touricho Guide Application has been Approved!",
    html,
    text,
    from: FROM_SUPPORT,
  })
}

// ─── Booking confirmation emails ─────────────────────────────────────────────

export interface BookingEmailData {
  touristName: string
  touristEmail: string
  guideName: string
  guideEmail: string
  tourTitle: string
  tourDate: string
  tourTime: string
  tourTimeZone?: string
  meetingPoint: string
  adults: number
  children: number
  bookingId: string
}

function formatDate(isoString: string, timeZone?: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  })
}

function formatTime(isoString: string, timeZone?: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  })
}

export async function sendBookingConfirmationEmails(data: BookingEmailData) {
  const mg = getClient()
  const tourDate = formatDate(data.tourDate, data.tourTimeZone)
  const tourTime = formatTime(data.tourTime, data.tourTimeZone)
  const totalGuests = data.adults + data.children
  const [googleReviewUrlValue, trustpilotReviewUrlValue] = await Promise.all([
    getPlatformGoogleReviewUrl(),
    getPlatformTrustpilotReviewUrl(),
  ])
  const googleReviewUrl = googleReviewUrlValue || DEFAULT_GOOGLE_REVIEW_URL
  const trustpilotReviewUrl = trustpilotReviewUrlValue || DEFAULT_TRUSTPILOT_REVIEW_URL
  const reviewLinksText = `
Loved your tour? Leave a quick review:
Google: ${googleReviewUrl}
Trustpilot: ${trustpilotReviewUrl}`
  const reviewLinksHtml = `
    <div style="margin-top:24px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827">Loved your tour? Leave a quick review!</p>
      <p style="margin:0 0 12px;font-size:14px;color:#4b5563">It only takes 2 minutes and helps your guide enormously.</p>
      <a href="${googleReviewUrl}" style="display:inline-block;margin:0 8px 10px 0;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Leave a Google Review</a>
      <a href="${trustpilotReviewUrl}" style="display:inline-block;margin:0 8px 10px 0;background:#166534;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Leave a Trustpilot Review</a>
    </div>`

  // Tourist confirmation email
  const touristText = `Hi ${data.touristName},

Your booking is confirmed! Here are your details:

Tour: ${data.tourTitle}
Date: ${tourDate}
Time: ${tourTime}
Meeting Point: ${data.meetingPoint}
Guests: ${data.adults} adult${data.adults !== 1 ? "s" : ""}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? "ren" : ""}` : ""}
Your guide: ${data.guideName}
Booking Reference: ${data.bookingId}

Please arrive 10 minutes before the tour starts.
${reviewLinksText}

See you soon,
The Touricho Team`

  const touristHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#F14D4C;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">Booking Confirmed!</h1>
  </div>
  <div style="padding:24px;background:#f9fafb;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
    <p style="margin:0 0 16px">Hi <strong>${data.touristName}</strong>,</p>
    <p style="margin:0 0 24px">Your booking is confirmed. Here are your details:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280;width:40%">Tour</td>
        <td style="padding:10px 0;font-weight:600">${data.tourTitle}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Date</td>
        <td style="padding:10px 0">${tourDate}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Time</td>
        <td style="padding:10px 0">${tourTime}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Meeting Point</td>
        <td style="padding:10px 0">${data.meetingPoint || "To be confirmed"}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Guests</td>
        <td style="padding:10px 0">${data.adults} adult${data.adults !== 1 ? "s" : ""}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? "ren" : ""}` : ""}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Your Guide</td>
        <td style="padding:10px 0">${data.guideName}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280">Booking Reference</td>
        <td style="padding:10px 0;font-family:monospace;font-size:12px">${data.bookingId}</td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Please arrive 10 minutes before the tour starts.</p>
${reviewLinksHtml}
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280">See you soon,<br><strong>The Touricho Team</strong></p>
  </div>
</div>`

  // Guide notification email
  const guideText = `Hi ${data.guideName},

You have a new booking for your tour!

Tour: ${data.tourTitle}
Date: ${tourDate}
Time: ${tourTime}
Tourist: ${data.touristName}
Guests: ${totalGuests} (${data.adults} adult${data.adults !== 1 ? "s" : ""}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? "ren" : ""}` : ""})
Booking Reference: ${data.bookingId}

Log in to your dashboard to view booking details.

The Touricho Team`

  const guideHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">New Booking Received!</h1>
  </div>
  <div style="padding:24px;background:#f9fafb;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
    <p style="margin:0 0 16px">Hi <strong>${data.guideName}</strong>,</p>
    <p style="margin:0 0 24px">You have a new booking for your tour:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280;width:40%">Tour</td>
        <td style="padding:10px 0;font-weight:600">${data.tourTitle}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Date</td>
        <td style="padding:10px 0">${tourDate}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Time</td>
        <td style="padding:10px 0">${tourTime}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Tourist</td>
        <td style="padding:10px 0">${data.touristName}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Guests</td>
        <td style="padding:10px 0">${totalGuests} total (${data.adults} adult${data.adults !== 1 ? "s" : ""}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? "ren" : ""}` : ""})</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280">Booking Reference</td>
        <td style="padding:10px 0;font-family:monospace;font-size:12px">${data.bookingId}</td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280">Log in to your dashboard to view full booking details.<br><br><strong>The Touricho Team</strong></p>
  </div>
</div>`

  await Promise.all([
    mg.messages.create(MAILGUN_DOMAIN, {
      from: FROM_BOOKING,
      to: [`${data.touristName} <${data.touristEmail}>`],
      subject: `Booking Confirmed – ${data.tourTitle}`,
      text: touristText,
      html: touristHtml,
    }),
    mg.messages.create(MAILGUN_DOMAIN, {
      from: FROM_BOOKING,
      to: [`${data.guideName} <${data.guideEmail}>`],
      subject: `New Booking – ${data.tourTitle}`,
      text: guideText,
      html: guideHtml,
    }),
  ])
}
