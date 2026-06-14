'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STEPS = ['Create your bot', 'Add bot to a chat', 'Get your Chat ID']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (token: string, chatId: string) => void
}

export function TelegramSetupGuide({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setStep(0)
      setToken('')
      setChatId('')
    }
    onOpenChange(nextOpen)
  }

  function handleFinish() {
    onComplete(token.trim(), chatId.trim())
    handleClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Telegram</DialogTitle>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4">
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                Open Telegram and search for{' '}
                <strong className="text-foreground">@BotFather</strong>, or{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  open it directly
                </a>
                .
              </li>
              <li>
                Send the command{' '}
                <code className="rounded bg-muted px-1">/newbot</code> and
                follow the prompts to choose a name and username for your bot.
              </li>
              <li>
                BotFather will reply with a token like{' '}
                <code className="rounded bg-muted px-1">123456789:ABC-...</code>
                . Copy it and paste it below.
              </li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="tg-setup-token">Bot Token</Label>
              <Input
                id="tg-setup-token"
                type="password"
                placeholder="123456789:ABC-..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Choose where you want alerts delivered:</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">Group or channel</p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>Add your bot as a member of the group or channel.</li>
                  <li>
                    If it&apos;s a channel, promote the bot to{' '}
                    <strong className="text-foreground">admin</strong> so it can
                    post messages.
                  </li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Direct message (personal alerts)
                </p>
                <ol className="mt-1 list-inside list-decimal space-y-1">
                  <li>Search for your bot by its username in Telegram.</li>
                  <li>
                    Open a chat with it and send{' '}
                    <code className="rounded bg-muted px-1">/start</code> so it
                    registers your conversation.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                Send any message in the chat (or{' '}
                <code className="rounded bg-muted px-1">/start</code> in a DM)
                so your bot has something to see.
              </li>
              <li>
                Open this URL in your browser, replacing{' '}
                <code className="rounded bg-muted px-1">TOKEN</code> with your
                bot token:
                <div className="mt-1.5 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">
                  https://api.telegram.org/bot
                  <span className="text-primary">TOKEN</span>
                  /getUpdates
                </div>
              </li>
              <li>
                Find the{' '}
                <code className="rounded bg-muted px-1">chat.id</code> value in
                the JSON response. Channel IDs begin with{' '}
                <code className="rounded bg-muted px-1">-100</code>.
              </li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="tg-setup-chat-id">Chat ID</Label>
              <Input
                id="tg-setup-chat-id"
                placeholder="-100123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? handleClose(false) : setStep(step - 1))}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !token.trim()}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!token.trim() || !chatId.trim()}
            >
              Save to form
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
