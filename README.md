# AI Product Design Interview

An AI-led product design interview that runs as a structured conversation, not a chatbot.

---

## What this is

A prototype that conducts a real product design interview using a phase-based conversation engine. The candidate uploads their resume, and the AI runs through a defined interview arc — orientation, motivation, past work, a startup scenario, and a design critique — before closing cleanly.

Built as part of a product design assignment for Alt Inc.

Live: [hiring-pd-bot.vercel.app](https://hiring-pd-bot.vercel.app)

---

## Core idea

Most AI chat interfaces are reactive — they respond to whatever the user says. This prototype is different. The interview has structure enforced in code, not just in the prompt. The AI knows which phase it is in, how many turns have been used, and when to move forward. The candidate experience is a conversation; the system underneath is an evaluation engine.

---

## Key features

**Structured phase system**
The interview moves through six phases in order: orientation → motivation → past work → scenario → critique → wrap. Each phase has a turn limit. When the limit is hit, the phase advances automatically.

**Phase enforcement via state**
Phase and turn count are tracked client-side using refs and persisted to `localStorage`. The current phase is sent to the API on every request so the model receives a specific instruction block — not just a general prompt.

**Adaptive questioning**
Questions are grounded in the candidate's actual resume. The model is instructed to probe ownership, tradeoffs, problem framing, and taste — not generic design process questions.

**Low-effort handling**
If the candidate is one-word or disengaged, the AI acknowledges limited signal calmly and moves on. No shaming, no repeating the same question.

**Resume parsing**
PDF resumes are parsed server-side on upload. The extracted text is stored in `localStorage` and attached as context to every API call.

**Session resume**
If the candidate refreshes mid-interview, the transcript and phase state are restored from `localStorage`. The interview picks up where it left off.

---

## System design

```
Landing page
  └── PDF upload → /api/parse-resume → resume text stored in localStorage

Interview page
  ├── On mount: load transcript + phase state from localStorage
  ├── On first load: trigger API call with phase = "orientation"
  ├── On each user message:
  │     ├── Append to transcript
  │     ├── POST to /api/interview with { messages, candidate, phase }
  │     └── Stream response back, split on [SPLIT] into separate bubbles
  └── After each response:
        ├── Increment phase turn counter
        ├── Advance phase if turn limit reached
        └── Persist phase + count to localStorage
```

The API route constructs a system prompt from two layers: a base prompt with identity, reaction rules, and formatting constraints, plus a per-phase instruction block that tells the model exactly what it should be doing in the current moment. Phase progression is deterministic — the model cannot skip ahead or loop.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| AI | Anthropic Claude Sonnet via `@anthropic-ai/sdk` |
| Streaming | Native `ReadableStream` from the Anthropic SDK |
| PDF parsing | `unpdf` (serverless-compatible) |
| UI components | shadcn/ui (Radix UI + Tailwind CSS) |
| Fonts | Geist, Geist Mono (local variable fonts) |
| Deployment | Vercel |

---

## Run locally

```bash
git clone <repo>
cd alt-interview-demo
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=your_key_here
```

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000), upload a PDF resume, and start the interview.

---

## Known limitations

- **No authentication.** Anyone with the URL can run an interview session.
- **Single session per browser.** `localStorage` ties the session to one device and browser tab.
- **30s API timeout.** The Vercel function has a 30-second max duration. Slow responses from the model may time out.
- **Phase logic is client-side.** Phase state lives in the browser. A cleared cache restarts the interview.
- **No transcript export.** The interview ends with no way to save or share the result.

---

## Future improvements

- **Evaluator layer.** A second model pass that reads the full transcript and produces a structured signal report — ownership clarity, ambiguity tolerance, taste level, red flags.
- **Interviewer personas.** Configurable voice and focus area per role or team.
- **Admin view.** A separate interface to review transcripts and compare candidates.
- **Multi-session support.** Replace `localStorage` with a server-side session tied to a candidate invite link.
- **Transcript export.** End-of-interview PDF or structured JSON output.

---

Built by [Ayan Aggarwal](https://linkedin.com/in/ayanaggarwal) as a product design prototype.
