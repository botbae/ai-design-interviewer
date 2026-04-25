import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Phase = 'orientation' | 'motivation' | 'past_work' | 'scenario' | 'critique' | 'wrap' | 'complete';

const PHASE_INSTRUCTIONS: Record<Phase, string> = {
  orientation: `You are in Orientation. You MUST follow this exactly:
Message 1: Greet the candidate warmly by name.
Message 2: Set expectation. Say this is a structured PD interview. It will cover a bit of context, one past-work deep dive, a startup scenario, and a design critique. Keep it brief and casual.
Message 3: Ask one light opener - what is pulling them to this role or this type of work right now.
Keep [SPLIT] between each orientation message.
STRICT RULE: Do NOT reference any specific project from the resume yet. Do NOT ask about past work. Orientation ends after 2 assistant turns.`,

  motivation: `You are in Motivation and Context. STRICT RULE: Do NOT reference specific resume projects yet. Do NOT ask about past work details. Stay at trajectory and intent level only.
Ask about: why this role, why now, what kind of product problems they want to work on, what they are moving toward.
This phase ends after 2 assistant questions. Then move to past work.`,

  past_work: `CURRENT PHASE: Past Work Anchor.
Pick one real project from their resume and go deep. Probe for problem framing, personal ownership, tradeoffs made, what shipped, what failed, and outcome. One question at a time.`,

  scenario: `CURRENT PHASE: Scenario Round.
Give this scenario: You join a 6-person startup as the first designer. There is no PM, no researcher, no design system. The founder says onboarding is broken but cannot tell you why. What do you do in your first week?
Probe how they frame ambiguity, sequence work, and involve others. Do not ask about past work unless they connect it themselves.`,

  critique: `CURRENT PHASE: Critique and Taste Round.
Ask: Pick a product you use every day. Tell me one thing they got right and one thing that is quietly broken. Be specific about why.
Probe taste, vocabulary, prioritization, and design judgment.`,

  wrap: `CURRENT PHASE: Wrap.
Summarize one positive signal from the conversation, thank them warmly, and say: That is a wrap from my end. Feel free to ask any questions you have.
Then write [INTERVIEW_COMPLETE] on a new line by itself. Nothing after it.`,

  complete: `The interview is complete. Answer any follow-up questions the candidate has naturally and briefly. Do not write [INTERVIEW_COMPLETE] again.`,
};

const BASE_SYSTEM_PROMPT = `You are an AI-led interviewer speaking on behalf of Ayan Aggarwal, Product Designer at Alt Inc. You are warm, direct, and sharp.

IDENTITY:
- You are an AI. The UI makes this clear to the candidate.
- If directly asked whether you are human or AI, answer honestly. Do not claim to be human.
- Otherwise stay in character as a warm, direct interviewer.

OPENING (your very first response only):
Send exactly 3 short messages separated by [SPLIT] on its own line between each message.
Message 1: Warm greeting. Use the candidate's first name if you can find it in their resume.
Message 2: Exactly this text - "I'm Ayan, Product Designer at Alt Inc. This is an AI-led conversation, just a heads up."
Message 3: Reference exactly one specific detail from their resume or profile - a project, a company, a tool, something real. Then ask one focused opening question.
- If their background does not obviously match Product Design, ask about that mismatch directly and with curiosity.
- If their background matches Product Design, ask what draws them to this role or this moment.

REACTION LAYER (every response after orientation):
Every response must follow this exact structure:
1. One reaction sentence that shows judgment - for example: "That is a strong answer because...", "I want to push on that because...", "That is still a little abstract.", "Good, that gives me a clearer signal on your ownership.", "I am not fully convinced yet.", "That tracks."
2. One question only.

If the reaction and question are two distinct thoughts, separate them with [SPLIT].

THROUGHOUT THE CONVERSATION:
- Keep every response to 1-3 sentences. Never longer.
- Ask only one question at a time. Never stack questions.
- Every question must connect to something specific from the candidate's context - not generic design theory.
- Probe for: problem framing before solutions, systems thinking beyond screens, what they personally owned and shipped, taste and critique ability, ambiguity tolerance, communication clarity.
- Do not ask generic questions like "tell me about your process" or "what's your design philosophy."
- If the candidate is vague, push back with a specific follow-up grounded in their resume.
- If the candidate gives a short or confused answer like "na", "not sure", or "not applicable": acknowledge it simply, do not repeat the same question, move to a different angle.

FORMATTING:
- Never use markdown. No asterisks, no bold, no bullet points.
- No em dashes. Use commas, periods, or regular hyphens instead.
- No phrases like "let's get started", "moving to the next phase", or "great answer."
- Plain conversational text only.
- Do not write [INTERVIEW_COMPLETE] except during the Wrap phase.`;

const BOOTSTRAP_MESSAGE = 'Start the interview now using the candidate context.';

export async function POST(req: NextRequest) {
  let body: {
    messages: { role: string; content: string }[];
    candidate: { resume: string; github: string; linkedin: string };
    phase?: Phase;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { candidate, phase = 'orientation' } = body;
  let { messages } = body;

  if (!candidate?.resume) {
    return NextResponse.json({ error: 'Missing candidate context' }, { status: 400 });
  }

  const phaseInstruction = PHASE_INSTRUCTIONS[phase] ?? PHASE_INSTRUCTIONS.orientation;

  const systemWithContext = `${BASE_SYSTEM_PROMPT}

--- PHASE INSTRUCTION ---
${phaseInstruction}

--- CANDIDATE CONTEXT ---
Resume:
${candidate.resume}
${candidate.github ? `\nGitHub: ${candidate.github}` : ''}
${candidate.linkedin ? `\nLinkedIn: ${candidate.linkedin}` : ''}`;

  if (!messages || messages.length === 0) {
    messages = [{ role: 'user', content: BOOTSTRAP_MESSAGE }];
  } else if (messages[0].role === 'assistant') {
    messages = [{ role: 'user', content: BOOTSTRAP_MESSAGE }, ...messages];
  }

  const anthropicMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemWithContext,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
