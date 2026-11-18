# AI Design Interviewer

An open-source AI interviewer for **first-round product design interviews**. Upload a resume (and, if you like, a job description), have a 20-minute chat with an AI interviewer, and get a scored summary report at the end.

The twist: **code, not the AI, runs the interview.** A small state machine decides which step you're in and when to move on. The AI only decides *how* to ask within each step. That keeps every candidate on the same path, which is what hiring research recommends for fair, comparable interviews.

> Built by [Ayan Aggarwal](https://linkedin.com/in/ayanaggarwal), a product designer, as a prototype exploring what a good AI-led design interview should feel like.

---

## What it does

1. **Upload.** Resume as PDF, Word (.docx), PNG or JPG, or pasted text. Optional job description. Scanned PDFs and photos are read by the AI if your model supports it.
2. **Interview.** Six steps with fixed turn limits:

   | Step | Turns | What happens |
   |---|---|---|
   | Welcome | 1 | Says it's an AI, explains the format, asks about motivation |
   | Motivation | 2 | Why this role, why now |
   | Past work | 4 | Deep dive on one real project from the resume |
   | Scenario | 3 | "First designer at a 6-person startup, onboarding is broken. What do you do in week one?" |
   | Critique | 2 | "One thing a product gets right, one thing quietly broken" |
   | Wrap-up | 1 | Thanks the candidate and opens the report |

3. **Adapts to the person.** Career switchers, juniors and seniors get different depth. Weak resume and JD matches still get a fair interview. "Skip" and one-word answers are handled calmly, without repeating the question.
4. **Report.** Six skills scored 1 to 4 with quotes from the conversation as evidence, plus strengths, growth areas and fit with the JD. Save it as PDF or Markdown.

Everything stays in the candidate's browser. There's no database and no login.

**Accessible and responsive.** Checked with axe-core against WCAG 2.2 AA (0 issues), full keyboard use with visible focus, screen-reader friendly chat, reduced-motion support, and layouts tested from 320px phones to desktop.

## Quick start

You need [Node.js](https://nodejs.org) 22 or newer (24 recommended) and an API key from an AI provider.

```bash
git clone https://github.com/botbae/alt-interview-demo.git
cd alt-interview-demo
npm install
cp .env.example .env.local
```

Open `.env.local` and add your key, then:

```bash
npm run dev
```

Go to [http://localhost:3000](http://localhost:3000).

## Pick your AI

Set these in `.env.local`:

| Provider | `LLM_PROVIDER` | `LLM_BASE_URL` | Reads scans? |
|---|---|---|---|
| Anthropic (Claude) | `anthropic` | (leave empty) | Yes |
| OpenAI | `openai` | (leave empty) | Images yes; scanned PDFs may not read, so upload a PNG/JPG or paste |
| Google Gemini | `openai` | `https://generativelanguage.googleapis.com/v1beta/openai` | Try `LLM_VISION=true`; check Gemini's docs |
| Groq | `openai` | `https://api.groq.com/openai/v1` | No |
| Cerebras | `openai` | `https://api.cerebras.ai/v1` | No |
| Ollama (local, free) | `openai` | `http://localhost:11434/v1` | Only with a vision model |

Set `LLM_MODEL` to choose a model (defaults: `claude-sonnet-5-5`, `gpt-5-mini`). Smaller models follow the interview rules less reliably. If a scan can't be read, the app always falls back to asking for pasted text.

## How it works

```
Browser                                   Server (Next.js API routes)            AI provider
-------                                   ---------------------------            -----------
Upload page ── file ─────────────────────► /api/extract  (checks type, size,
            ◄─ text ──────────────────────                pages; AI reads scans) ──► model
Chat page ── step + chat + resume + JD ──► /api/interview (checks, rate limit) ───► model
          ◄─ streamed reply ─────────────                                       ◄──
  counts turns, moves to next step
Report page ── transcript ───────────────► /api/report   (scores as JSON) ───────► model
```

| Folder | What's inside |
|---|---|
| `app/` | Pages (`/`, `/interview`, `/report`) and the API routes |
| `components/` | UI pieces (upload box, chat list, score bars) and shadcn/ui primitives |
| `lib/phases.ts` | The interview rulebook: steps, turn limits, step changes |
| `lib/prompts.ts` | All interviewer wording and the scoring rubric. **Start here to customise.** |
| `lib/llm.ts` | Provider adapter (Anthropic or OpenAI-compatible) |
| `lib/extract.ts` | File checks and text extraction |
| `lib/validate.ts`, `lib/guard.ts`, `lib/rate-limit.ts` | Input checks, access code and limits |
| `tests/` | Unit and API tests (`npm test`) |

## Customise it

- **Persona:** `INTERVIEWER_NAME`, `INTERVIEWER_ROLE`, `COMPANY_NAME` in `.env.local`.
- **Questions and tone:** `lib/prompts.ts`.
- **Number of turns per step:** `PHASE_LIMITS` in `lib/phases.ts`.
- **Skills in the report:** `COMPETENCIES` in `lib/prompts.ts`.

## Deploying it

It's a standard Next.js app, so it runs anywhere Node runs (`npm run build && npm start`), or on hosts like Vercel, Netlify or Render. **Before you share a public link:**

1. Set a monthly **spend limit** in your AI provider's console.
2. Set `ACCESS_CODE` so only invited people can use it.
3. Read [SECURITY.md](SECURITY.md).

## Limits, honestly

- It's a prototype, not a hiring product. The report is a starting point for a human reviewer, **never a hiring decision**. AI used in hiring is regulated in some places (for example the EU AI Act and New York City's bias-audit law), so check before using it for real candidates.
- The AI does not open GitHub or LinkedIn links. They're passed along as text.
- Rate limits live in server memory, so they reset on restart and count separately per serverless instance.
- One interview per browser. Clearing site data restarts it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start locally with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Run the tests |
| `npm run lint` / `npm run typecheck` | Code checks |

## Contributing

Ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [ROADMAP](ROADMAP.md).

## License

[MIT](LICENSE)
