'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const templateSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  label: z.string().min(1, 'Label is required'),
  method: z.enum(HTTP_METHODS),
  url: z.string().min(1, 'URL is required'),
  headers: z.string().optional(),
  payload_template: z.string().optional(),
})

type TemplateFormValues = z.infer<typeof templateSchema>

interface ActionTemplate {
  id: string
  category: string
  label: string
  actionType: string
  config: {
    url: string
    method: string
    headers?: unknown
    payload_template?: unknown
  }
  createdAt: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ActionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ActionTemplate | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      category: '',
      label: '',
      method: 'POST',
      url: '',
      headers: '',
      payload_template: '',
    },
  })

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  function openAddDialog() {
    setEditingTemplate(null)
    form.reset({
      category: '',
      label: '',
      method: 'POST',
      url: '',
      headers: '',
      payload_template: '',
    })
    setDialogOpen(true)
  }

  function openEditDialog(template: ActionTemplate) {
    setEditingTemplate(template)
    const config = template.config
    form.reset({
      category: template.category,
      label: template.label,
      method: (config.method as (typeof HTTP_METHODS)[number]) ?? 'POST',
      url: config.url ?? '',
      headers: config.headers ? JSON.stringify(config.headers, null, 2) : '',
      payload_template: typeof config.payload_template === 'string' ? config.payload_template : '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(values: TemplateFormValues) {
    setSubmitting(true)
    try {
      const body = {
        category: values.category,
        label: values.label,
        url: values.url,
        method: values.method,
        headers: values.headers?.trim() ? JSON.parse(values.headers) : null,
        payload_template: values.payload_template?.trim() || null,
      }

      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : '/api/templates'
      const method = editingTemplate ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        form.setError('root', { message: data.error ?? 'Something went wrong' })
        return
      }

      setDialogOpen(false)
      await fetchTemplates()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(template: ActionTemplate) {
    if (!window.confirm(`Delete "${template.label}"?`)) return

    const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchTemplates()
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Action Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure webhook actions triggered from event detail
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Template</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.category}</TableCell>
                <TableCell>{t.label}</TableCell>
                <TableCell className="font-mono text-xs">{t.config.method}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {t.config.url}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.createdAt ? formatDate(t.createdAt) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(t)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(t)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Add Template'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. stripe.charge.failed" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Retry Payment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Controller
                control={form.control}
                name="method"
                render={({ field, fieldState }) => (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Method</label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {HTTP_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/webhook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="headers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Headers</FormLabel>
                    <FormControl>
                      <textarea
                        className="h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder={'{"Authorization": "Bearer token"}'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payload_template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payload Template</FormLabel>
                    <FormControl>
                      <textarea
                        className="h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder='{"event": "{{category}}", "title": "{{title}}"}'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use {'{{source}}'}, {'{{severity}}'}, {'{{title}}'}, {'{{category}}'} as placeholders
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}

              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingTemplate ? 'Save Changes' : 'Create Template'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
