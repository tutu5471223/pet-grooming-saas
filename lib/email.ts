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

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  // SMTP implementation would go here when SMTP_HOST is configured.
  // SEC-7: do not log recipient PII or the full message body in production.
  if (process.env.NODE_ENV === "production") {
    console.log(`[Email] queued -> ${maskEmail(to)} | subject="${subject}"`)
    return
  }
  console.log(`\n📧 [Email]\nTo: ${to}\nSubject: ${subject}\n${"─".repeat(40)}\n${html.replace(/<[^>]+>/g, "")}\n${"─".repeat(40)}\n`)
}
