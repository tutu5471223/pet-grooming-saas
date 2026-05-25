interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  // SMTP implementation would go here when SMTP_HOST is configured
  console.log(`\n📧 [Email]\nTo: ${to}\nSubject: ${subject}\n${"─".repeat(40)}\n${html.replace(/<[^>]+>/g, "")}\n${"─".repeat(40)}\n`)
}
