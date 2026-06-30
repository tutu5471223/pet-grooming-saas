import nodemailer from "nodemailer"

interface EmailOptions {
  to: string
  subject: string
  html: string
}

function maskEmail(addr: string): string {
  const [local, domain] = addr.split("@")
  if (!domain) return "***"
  return `${local.slice(0, 2)}***@${domain}`
}

function createTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // M9: bound SMTP so a slow/hung mail server can't suspend the request.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  })
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  // SEC-7: do not log full PII or message body in production.
  const transporter = createTransport()

  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[Email] SMTP not configured – skipped -> ${maskEmail(to)} | subject="${subject}"`)
    } else {
      console.log(`\n📧 [Email – dev stub]\nTo: ${to}\nSubject: ${subject}\n${"─".repeat(40)}\n${html.replace(/<[^>]+>/g, "")}\n${"─".repeat(40)}\n`)
    }
    return
  }

  // M9/M15: never throw — callers invoke this best-effort and must not turn a
  // mail failure into a 500. Swallow + log on failure.
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
    })
    console.log(`[Email] sent -> ${maskEmail(to)} | subject="${subject}"`)
  } catch (err) {
    console.error(`[Email] send failed -> ${maskEmail(to)} | subject="${subject}"`, err)
  }
}
