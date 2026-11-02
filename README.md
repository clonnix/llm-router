# LLM Router

Your own OpenAI-compatible endpoint with your own API key(s), in front of CometAPI (cometapi.com). No dependencies, Node 20+.

## Use it

- Chat endpoint (JanitorAI Proxy URL): `https://<your-service>.onrender.com/v1/chat/completions`
- API key: one of the keys in `API_KEYS`
- Model: the provider's own model ID

| Model | ID |
|---|---|
| GLM-5.3 Flash | `glm-5.3-flash` |
| DeepSeek V4.1 Flash | check CometAPI's model list |

Any other CometAPI model ID works too.

## Environment variables

| Name | What |
|---|---|
| `API_KEYS` | Your own key(s), comma-separated. Generate with `openssl rand -hex 32`. |
| `COMETAPI_API_KEY` | From cometapi.com |
| `ALLOWED_ORIGINS` | `*` or a comma-separated list like `https://janitorai.com` |

## Adding another provider

Add an entry to `PROVIDERS` in `index.js` (chat-completions URL + env var for its key). Then send `<provider>/<model id>` to use it.
