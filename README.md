# eve chat with Vercel Passport

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fremiconnesson%2Feve-chat-passport)

A private eve chat app authenticated by [Vercel Passport](https://vercel.com/kb/guide/vercel-passport). Each visitor gets chat history synchronized through a private Vercel Blob store.

## What you get

- Identity-provider sign-in through Vercel Passport
- Per-visitor chat history backed by private Vercel Blob storage
- Web search through Vercel AI Gateway
- File uploads and a sandbox where the agent can work
- Image generation and downloadable files
- A Next.js interface built with AI Elements

## Deploy your agent

You need a Vercel Enterprise team with Passport configured.

1. Click **Deploy** and create the project in your Passport-enabled team.
2. In the project **Storage** tab, create a private Blob store and connect it to the project.
3. Assign your team's Passport connector to the project if it did not inherit the team default.
4. Redeploy after connecting Blob, then open the production URL and sign in through your identity provider.

Vercel supplies short-lived credentials for both AI Gateway and the connected Blob store, so the production deployment does not need provider API keys or a long-lived Blob token.

## Try your first tasks

Start a conversation with one of these prompts:

- `Search the web for the latest news about eve and summarize the sources.`
- `Create an image of a small robot tending a rooftop garden.`
- Upload a document, then ask: `Summarize this file and list the decisions I need to make.`
- `Create a Markdown report from our conversation and give me the file.`

The agent shows tool activity in the conversation. Generated images appear in the chat, and other files include a download action.

## Make the agent yours

Start by editing [`agent/instructions.md`](./agent/instructions.md). The main extension points are:

| File | What it controls |
| --- | --- |
| [`agent/instructions.md`](./agent/instructions.md) | The agent's role and behavior |
| [`agent/agent.ts`](./agent/agent.ts) | The model the agent uses |
| [`agent/tools/`](./agent/tools) | Extra actions the agent can take |

Follow the [eve first-agent tutorial](https://eve.dev/docs/tutorial/first-agent) to learn how instructions, models, and tools work.

## Run it locally

Local development requires [Node.js 24](https://nodejs.org/en/download), [pnpm](https://pnpm.io/installation), and the [Vercel CLI](https://vercel.com/docs/cli). Link to a project that already has its Blob store connected:

```bash
pnpm install
vercel link
vercel env pull .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Loopback development uses a local development identity; deployed environments require Passport.

## Privacy and persistence

The server derives identity only from Passport's verified `x-vercel-oidc-passport-token` header and scopes data with its stable `external_sub` claim. Raw subjects are hashed before they become Blob path prefixes, and chat records are stored as private blobs.

History follows the same Passport identity across browsers and devices. Deleting a chat removes its Blob record, but it does not delete the underlying eve workflow run. Streaming deltas and inline generated-file bytes are removed before persistence.

## Learn more

- [Vercel Passport guide](https://vercel.com/kb/guide/vercel-passport)
- [Vercel Blob documentation](https://vercel.com/docs/vercel-blob)
- [eve documentation](https://eve.dev/docs)
- [Implementation and maintenance notes](./AGENTS.md)
