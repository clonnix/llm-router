# LLM Router

One API key for DeepSeek, GLM (Z.ai) and Gemma (Google), behind an OpenAI-compatible endpoint. No dependencies, Node 20+.

## Use it

- Base URL: `https://<your-service>.onrender.com/v1`
- Chat endpoint (for JanitorAI's Proxy URL): `https://<your-service>.onrender.com/v1/chat/completions`
- API key: one of the keys in `API_KEYS`
- Model: `<provider>/<model id>`

| Prefix | Goes to | Example model |
|---|---|---|
| `deepseek/` | api.deepseek.com | `deepseek/deepseek-v4.1-flash` |
| `glm/` | api.z.ai | `glm/glm-5.3-flash` |
| `gemma/` | Google Gemini API | `gemma/gemma-4-31b-it` |

Everything after the prefix is sent to the provider unchanged, so check each provider's model list for the exact ID.

## Environment variables

| Name | What |
|---|---|
| `API_KEYS` | Your own key(s), comma-separated. Generate with `openssl rand -hex 32`. |
| `DEEPSEEK_API_KEY` | From platform.deepseek.com |
| `ZAI_API_KEY` | From z.ai (standard API key, not a Coding Plan key) |
| `GEMINI_API_KEY` | From aistudio.google.com/apikey |
| `ALLOWED_ORIGINS` | `*` or a comma-separated list like `https://janitorai.com` |

## Deploy to Render

1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, pick the repo (it reads `render.yaml`).
3. Fill in the secret env vars when asked.
4. Test: `curl https://<your-service>.onrender.com/health`

## Run locally

```bash
API_KEYS=test DEEPSEEK_API_KEY=... node index.js
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer test" -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v4.1-flash","messages":[{"role":"user","content":"hi"}]}'
```

## Adding a provider

Add an entry to `PROVIDERS` in `index.js` with its chat-completions URL and an env var for its key, then add a model to `MODELS`.
