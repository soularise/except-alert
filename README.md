This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Docker

The full stack (ExceptAlert + Relay + Postgres) is managed via `docker-compose.yml` in this repo.

```bash
docker compose up --build
```

### Database migrations

Migrations must be applied before the app can serve requests. Run them against the target database:

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npx drizzle-kit migrate
```

When running via Docker Compose, apply migrations against the exposed Postgres port (5432) before or after `docker compose up`.

### Admin provisioning

The admin provisioning page is available at `/admin/provision` for configured admin emails.

```bash
EXCEPTALERT_ADMIN_EMAILS=hello@exceptalert.com,droidsafari@gmail.com
EXCEPTALERT_APP_URL=https://app.exceptalert.com
```

Provisioning creates a customer user, credential login, tenant, and owner membership. The page shows a one-time temporary password; after signing in, the customer should update it from Settings -> Account.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
