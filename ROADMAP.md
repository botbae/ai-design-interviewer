# Roadmap

Ideas for where this could go next. Each one is a good-sized pull request. Comment on the matching issue before starting a big one.

## Interview quality
- **Interview plans from the job description.** Let the AI suggest the scenario and critique prompts from the JD, while code still controls the order and length of steps.
- **Reconciliation questions.** Re-ask an earlier claim from a new angle later in the conversation to check consistency.
- **Configurable steps.** Load steps, limits and wording from a JSON file so teams can build their own interview without touching code.
- **More roles.** Templates for UX research, content design and design leadership.

## Inputs
- **Read public GitHub profiles** (pinned repos, README) with the GitHub API. LinkedIn does not allow automated reading, so it stays text only.
- **Portfolio links** (Figma, Behance, personal sites), with clear consent.

## Recruiter side
- **Saved reports and a reviewer dashboard.** Needs sign-in and a database (for example Postgres or Supabase).
- **Invite links** so a recruiter sets the JD and the candidate only sees the interview.
- **Compare candidates** on the same rubric.

## Fairness and compliance
- **Bias checks.** Run the same answers with different names and backgrounds and compare scores.
- **Audit trail.** Keep the prompt version, model and rubric with each report.
- If you use this for real hiring, check local rules first. AI used in hiring is treated as "high-risk" under the EU AI Act, and New York City requires bias audits for automated hiring tools. A human should always make the decision.

## Platform
- **Shared rate limiting** (Redis or Upstash) for serverless hosts.
- **Voice mode.**
- **Dockerfile** for one-command self-hosting.
