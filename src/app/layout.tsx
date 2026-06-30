import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ExceptAlert',
  description: 'Webhook event monitor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var p=localStorage.getItem('ea-palette');if(p==='monitoring')p='signal';if(p==='signal'||p==='terminal')document.documentElement.dataset.palette=p}catch(e){}})()`,
        }} />
      </head>
      <body className="flex h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
