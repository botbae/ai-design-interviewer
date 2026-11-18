# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.
Use GitHub's private reporting instead: go to the **Security** tab of this repository and click **Report a vulnerability**.

You can expect a first reply within 7 days. Please include steps to reproduce and the impact you see.

## Supported versions

Only the latest version on `main` gets security fixes.

## Running it safely

This app calls a paid AI API with **your** key. If you deploy it where others can reach it:

- Set a **monthly spend limit** in your AI provider's console. This is the only hard cap.
- Set `ACCESS_CODE` so only people you invite can start an interview.
- Keep the built-in limits on (`RATE_LIMIT_PER_MINUTE`, `DAILY_MODEL_CALL_LIMIT`). They are kept in server memory, so on serverless hosts each instance counts separately; use a shared store such as Redis for stronger limits.
- Put it behind a proxy you trust. The per-visitor limit reads `x-forwarded-for`, which a client can fake when there is no proxy in front.
- Never commit `.env.local`. Use a separate API key just for this app so you can revoke it on its own.

## What the app protects against

- Every request is checked for shape and size before it reaches the AI.
- Uploads are checked by their real contents (not the file name), capped at 5 MB and 10 pages, and locked or damaged files are refused.
- Error messages are generic; details only go to the server log.
- The API key never reaches the browser.
- Resume, job description and transcript live in the visitor's browser only. Nothing is stored on the server.
