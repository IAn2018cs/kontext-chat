# Kontext Chat

A chat app that generates images using Replicate and Cloudflare Workers.

Kontext Chat is powered by [FLUX.1 Kontext Pro](https://replicate.com/black-forest-labs/flux-kontext-pro), a new image model from Black Forest Labs, running on [Replicate](https://replicate.com/black-forest-labs/flux-kontext-pro). The app is built with Hono and React and it deployed on [Cloudflare Workers](https://workers.dev/).

See [kontext-chat.replicate.dev](https://kontext-chat.replicate.dev/) for a live demo.

## Local Development

1. Install dependencies:
   ```sh
   npm install
   ```

1. Get a Replicate API Token:
   - Sign up at https://replicate.com/ and get your REPLICATE_API_TOKEN from your account settings at https://replicate.com/account/api-tokens.

1. Set up your local environment:
   - Create a .dev.vars file in the project root (copy from .dev.vars.example) and configure:
     ```
     REPLICATE_API_TOKEN=your-token-here
     REPLICATE_MODEL=black-forest-labs/flux-kontext-pro
     REPLICATE_MODELS=[{"name": "FLUX.1 Kontext Pro", "value": "black-forest-labs/flux-kontext-pro"}, {"name": "FLUX.1 Schnell", "value": "black-forest-labs/flux-schnell"}]
     OPENAI_API_KEY=your-openai-api-key-here
     AWS_ACCESS_KEY_ID=your-aws-access-key-id
     AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
     AWS_REGION=us-east-1
     AWS_BUCKET_NAME=your-s3-bucket-name
     ```

1. Start the local dev server:
   ```sh
   npm run dev
   ```
   - The app will be available at http://localhost:8787 by default.

## Deployment to Cloudflare

1. Authenticate Wrangler:
   ```sh
   npx wrangler login
   ```

1. Set environment variables as secrets:
   ```sh
   npx wrangler secret put REPLICATE_API_TOKEN
   npx wrangler secret put REPLICATE_MODEL
   npx wrangler secret put REPLICATE_MODELS
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put AWS_ACCESS_KEY_ID
   npx wrangler secret put AWS_SECRET_ACCESS_KEY
   npx wrangler secret put AWS_REGION
   npx wrangler secret put AWS_BUCKET_NAME
   ```

1. Deploy:
   ```sh
   npm run deploy
   ```
   - Your app will be deployed to your Cloudflare Workers account.

## Notes

- The frontend is served from the public/ directory.
- The app supports multiple Replicate models through the REPLICATE_MODELS environment variable.
- Users can select different models from the dropdown in both upload and chat modes.
- Model selection is persistent during the chat session.
- The backend is a Cloudflare Worker (entry: src/index.ts).
- The app requires a valid REPLICATE_API_TOKEN to function.
