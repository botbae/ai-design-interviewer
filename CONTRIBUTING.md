# Contributing

Thanks for helping! Small, focused pull requests are easiest to review.

## Getting set up

```bash
git clone https://github.com/<your-username>/<your-fork>.git
cd <your-fork>
npm install
cp .env.example .env.local   # add your AI key
npm run dev                  # http://localhost:3000
```

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same checks on every pull request.

## Ground rules

- **Code owns the interview steps.** The order and length of steps live in `lib/phases.ts`. Prompts in `lib/prompts.ts` say *how* to behave inside a step and must never tell the model *when* to change step.
- **Keep the safety rules.** The low-effort handling, the stay-on-task rules and the "not a hiring decision" note are there on purpose. There are tests for them.
- **Never commit secrets.** Use `.env.local`.
- Prompt changes: describe what you tried and paste a short sample conversation in the PR.

Looking for something to work on? See [ROADMAP.md](ROADMAP.md) and issues labelled `good first issue`.

## Security issues

Please report them privately. See [SECURITY.md](SECURITY.md).
