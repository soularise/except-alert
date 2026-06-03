export async function sendSlackAlert(webhookUrl: string, message: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })
  if (!res.ok) {
    throw new Error(`Slack delivery failed: ${res.status} ${res.statusText}`)
  }
}
