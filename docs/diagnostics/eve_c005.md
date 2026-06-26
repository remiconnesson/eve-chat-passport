# EVE_C005: Blob storage missing

Chat history cannot be synchronized because the application has no Vercel Blob credentials.

## Recovery

Connect a private Blob store to the Vercel project. For local development, run `vercel env pull .env.local` after connecting the store, then restart the development server.
