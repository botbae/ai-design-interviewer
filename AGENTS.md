# AGENTS.md — AI Product Design Interview

## What this system is

An AI-led product design interview prototype. A candidate uploads their resume on the landing page, then the system runs a structured interview via a streaming chat interface. The AI speaks as Ayan Aggarwal, Product Designer at Alt Inc.

This is not a freeform chatbot. The interview has a fixed arc enforced in code. The model follows per-phase instructions and cannot drift between phases on its own.

---

## How the phase system works

Phases run in this order, with hard turn limits:

| Phase | Limit | Focus |
|---|---|---|
| orientation | 2 turns | Warm intro, AI disclosure, opening motivation question |
| motivation | 2 turns | Why this role, why now, trajectory |
| past_work | 4 turns | One real project from resume, deep probe |
| scenario | 3 turns | Startup scenario (first designer, broken onboarding) |
| critique | 2 turns | Pick a product, one thing right, one thing broken |
| wrap | 1 turn | Close warmly, emit `[INTERVIEW_COMPLETE]` |
| complete | — | Post-interview follow-up only |

**How it advances:**
- Phase and turn count live in `phaseRef` and `phaseCountRef` in `app/interview/page.tsx`
- After each API response, the client increments the count
- If count >= limit, the client advances to the next phase
- The new phase is persisted to `localStorage` (`interviewPhase`, `phaseCount`)
- The current phase is sent to `/api/interview` as `phase` in the request body
- The API injects the matching `PHASE_INSTRUCTIONS[phase]` block into the system prompt

The model cannot decide to change phases. Phase is entirely controlled by client state.

---

## Where prompts live

All prompts are in `app/api/interview/route.ts`.

**`PHASE_INSTRUCTIONS`** — one block per phase. This is the per-turn behavioral instruction injected on every request. Edit this to change what the AI does in a given phase.

**`BASE_SYSTEM_PROMPT`** — identity, reaction layer, formatting rules, and throughout-the-conversation guidance. This applies to every turn regardless of phase.

The final system prompt sent to the model is:

```
BASE_SYSTEM_PROMPT
+ "--- PHASE INSTRUCTION ---"
+ PHASE_INSTRUCTIONS[phase]
+ "--- CANDIDATE CONTEXT ---"
+ resume + github + linkedin
```

---

## How to modify behavior safely

**To change what the AI says in a phase:**
Edit only the relevant block in `PHASE_INSTRUCTIONS`. Do not touch `BASE_SYSTEM_PROMPT` or the phase state machine.

**To change how many turns a phase allows:**
Edit `PHASE_LIMITS` in `app/interview/page.tsx`. This is the only place phase lengths are defined.

**To add a new phase:**
1. Add it to the `Phase` type in both `route.ts` and `page.tsx`
2. Add a block to `PHASE_INSTRUCTIONS` in `route.ts`
3. Add a turn limit to `PHASE_LIMITS` in `page.tsx`
4. Insert it at the right position in `PHASE_ORDER` in `page.tsx`

**To change the scenario or critique question:**
Edit the `scenario` and `critique` blocks in `PHASE_INSTRUCTIONS`. The question text is embedded there.

**To change the reaction layer:**
Edit the `REACTION LAYER` section of `BASE_SYSTEM_PROMPT`. This controls the judgment-then-question structure.

---

## Rules — do not break these

**Never remove phase enforcement.**
The `PHASE_LIMITS` and `PHASE_ORDER` in `page.tsx` are the source of truth. If you only change the prompt without updating these, the model will receive wrong phase instructions at wrong times.

**Never let the prompt override state logic.**
The model does not decide when to advance phases. Do not add instructions like "after 3 questions, move to the scenario." Phase advancement is code, not prompt. If you add phase-change logic to the prompt, it will conflict with the client-side counter and produce inconsistent behavior.

**Never remove low-effort handling.**
The line in `BASE_SYSTEM_PROMPT` that says "if the candidate is low-effort... stay calm and neutral... note limited signal and move on" must stay. Without it the model will repeat questions or sound condescending.

**Never disable `[SPLIT]` parsing.**
The client splits `[SPLIT]` tokens into separate message bubbles and merges consecutive same-role messages before sending to the API. Both sides of this contract must stay intact.

**Never touch `.env.local`.**
`ANTHROPIC_API_KEY` must stay out of source control.

---

## Common pitfalls

**Model drifts into past work during orientation.**
Cause: the orientation instruction is not strict enough, or the base prompt's OPENING section references the resume. Fix: reinforce "Do NOT reference any specific project" in the `orientation` phase instruction.

**Model uses meta/scripted language ("structured", "phases", "agenda").**
Cause: the instruction block is written for the developer, not shaped as natural speech. Fix: rewrite the instruction using natural language constraints and add explicit forbidden words.

**Model skips motivation and jumps to past work.**
Cause: resume signal is strong and overrides the phase instruction. Fix: add "STRICT RULE: Do NOT ask about past work yet" to the `motivation` instruction.

**`[INTERVIEW_COMPLETE]` fires too early.**
Cause: the wrap instruction is too permissive, or the model pattern-matches on conversation length. Fix: add "Do not write [INTERVIEW_COMPLETE] except during the Wrap phase" to `BASE_SYSTEM_PROMPT` and be explicit in the `wrap` instruction.

**Consecutive same-role messages cause API errors.**
The Anthropic API rejects message arrays with consecutive same-role entries. The `mergeConsecutive()` function in `page.tsx` handles this. Do not remove it, and do not send the raw `messages` state to the API without passing it through `mergeConsecutive()` first.

**Build fails locally but passes on Vercel.**
This has happened because of a corrupted local `node_modules` (specifically `sucrase` and `ts-interface-checker`). Fix: `rm -rf node_modules && npm install`.

---

## Dev workflow

```bash
npm run dev        # local dev server at localhost:3000
npm run build      # production build check — run before every deploy
npm run lint       # ESLint
```

**Deploy:**
```bash
vercel --prod      # deploys to hiring-pd-bot.vercel.app
```

Always run `npm run build` locally before deploying. The Vercel build uses the same steps but starts from a clean install, so local build failures will always reproduce on Vercel.

**Do not run `git push`.** This project is deployed via the Vercel CLI directly.

---

## Key files

| File | Purpose |
|---|---|
| `app/page.tsx` | Landing page — resume upload, GitHub/LinkedIn inputs |
| `app/interview/page.tsx` | Interview UI — phase state, streaming, message rendering |
| `app/api/interview/route.ts` | API route — system prompt, phase instructions, Anthropic streaming |
| `app/api/parse-resume/route.ts` | PDF parsing endpoint |
| `app/globals.css` | Global styles, shadcn CSS variable overrides |
| `tailwind.config.ts` | Tailwind theme extended with shadcn CSS variable colors |
