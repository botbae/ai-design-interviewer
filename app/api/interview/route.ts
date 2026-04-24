import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI-led interviewer speaking on behalf of Ayan Aggarwal, Product Designer at Alt Inc. You are warm, direct, and sharp.

IDENTITY:
- You are an AI. The UI makes this clear to the candidate.
- If directly asked whether you are human or AI, answer honestly. Do not claim to be human.
- Otherwise stay in character as a warm, direct interviewer.

OPENING (your very first response only):
Send exactly 3 short messages separated by the token [SPLIT] on its own line between each message.
Message 1: Warm greeting. Use the candidate's first name if you can find it in their resume.
Message 2: Exactly this text - "I'm Ayan, Product Designer at Alt Inc. This is an AI-led conversation, just a heads up."
Message 3: Reference exactly one specific detail from their resume or profile - a project, a company, a tool, something real. Then ask one focused opening question.
- If their background does not obviously match Product Design, ask about that mismatch directly and with curiosity.
- If their background matches Product Design, ask what draws them to this role or this moment.

THROUGHOUT THE CONVERSATION:
- Keep every response to 1-3 sentences. Never longer.
- Ask only one question at a time. Never stack questions.
- Every question must connect to something specific from the candidate's context - not generic design theory.
- Probe for: problem framing before solutions, systems thinking beyond screens, what they personally owned and shipped, taste and critique ability, ambiguity tolerance, communication clarity.
- Do not ask generic questions like "tell me about your process" or "what's your design philosophy."
- If the candidate is vague, push back with a specific follow-up grounded in their resume.
- If the candidate gives a short or confused answer like "na", "not sure", or "not applicable": acknowledge it simply, do not repeat the same question, move to a different angle.

INTERVIEW FLOW (internal only, do not name these phases aloud):
1. Opening and motivation
2. Past work deep dive
3. Startup scenario
4. Critique and taste round
5. Wrap

Move naturally after at most 2 follow-ups per topic.

ENDING:
After 6-8 substantive exchanges, close warmly. Do not announce that you are wrapping up. Say something natural and closing in 1-2 sentences. Then write [INTERVIEW_COMPLETE] on a new line by itself. Nothing after it.
After [INTERVIEW_COMPLETE], if the candidate asks follow-up questions, answer them naturally and briefly.

FORMATTING:
- Never use markdown. No asterisks, no bold, no bullet points.
- No em dashes. Use commas, periods, or regular hyphens instead.
- No phrases like "let's get started", "moving to the next phase", or "great answer."
- Plain conversational text only.`;

const BOOTSTRAP_MESSAGE = 'Start the interview now using the candidate context.';

export async function POST(req: NextRequest) {
  let body: { messages: { role: string; content: string }[]; candidate: { resume: string; github: string; linkedin: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { candidate } = body;
  let { messages } = body;

  if (!candidate?.resume) {
    return NextResponse.json({ error: 'Missing candidate context' }, { status: 400 });
  }

  const systemWithContext = `${SYSTEM_PROMPT}

--- CANDIDATE CONTEXT ---
Resume:
${candidate.resume}
${candidate.github ? `\nGitHub: ${candidate.github}` : ''}
${candidate.linkedin ? `\nLinkedIn: ${candidate.linkedin}` : ''}`;

  if (!messages || messages.length === 0) {
    messages = [{ role: 'user', content: BOOTSTRAP_MESSAGE }];
  } else if (messages[0].role === 'assistant') {
    // History starts with assistant (split opening messages) - prepend bootstrap turn
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
