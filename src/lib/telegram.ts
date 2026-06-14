export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram delivery failed: ${res.status} ${body}`)
  }
}
