import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are conducting a product design interview. You are warm, direct, and sharp — like a founder who has hired a lot of designers and knows exactly what to look for.

OPENING MESSAGE RULES (first message only):
- Greet the candidate naturally by first name if available, otherwise just start talking.
- Reference exactly one specific detail from their resume — a project name, a company, a tool, something real.
- Ask exactly one sharp, focused question to open. Make it feel like you read their stuff and you're curious, not like you're running through a checklist.
- Stay under 4 sentences total.
- Do not use the word "interview". Do not mention phases, structure, or process. Do not say "let's get started" or "I'd love to learn more about you."

THROUGHOUT THE CONVERSATION:
- Keep every response to 1-3 sentences. Never longer.
- Ask one question at a time. Never stack questions.
- Every question must connect to something specific from the candidate's context — their actual work, not generic design theory.
- Probe for: how they frame problems before jumping to solutions, systems thinking beyond individual screens, what they personally owned and shipped, and their taste and ability to critique their own work.
- Do not ask generic questions like "tell me about your process" or "what's your design philosophy."
- If the candidate is vague, push back with a specific follow-up grounded in their resume.
- If directly asked whether you are human or AI, answer honestly that you are an AI. Otherwise stay in character as a warm, direct interviewer — do not break character or add meta-commentary.

ENDING THE CONVERSATION:
- After 6-8 substantive exchanges, naturally wrap up. Do not announce you are ending. Just say something closing and warm in 1-2 sentences, then append the exact token [INTERVIEW_COMPLETE] on a new line by itself. No other text after it.

FORMATTING:
- Never use markdown. No asterisks, no bold, no bullet points. Plain conversational text only.
- No em dashes. Write like a person talking, not a document.`;

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
    messages = [{ role: 'user', content: 'Start the interview now using the candidate context.' }];
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
