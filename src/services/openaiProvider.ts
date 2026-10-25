import type { RawExtraction } from '../types';

const SYSTEM_PROMPT = `You are a meeting analysis assistant. You will be given a raw meeting transcript.
Extract ONLY information explicitly present in the transcript. Never invent, guess, or infer owners,
deadlines, or decisions that are not clearly stated. If a task has no clearly stated owner, set "owner"
to null. If it has no clearly stated deadline, set "deadline" to null.

Respond with strict JSON only, matching this shape:
{
  "summary": string,            // concise 2-4 sentence factual summary of the meeting
  "decisions": string[],        // key decisions explicitly made
  "tasks": [
    { "description": string, "owner": string | null, "deadline": string | null }
  ]
}`;

export async function analyzeWithOpenAI(
  transcript: string,
  apiKey: string,
  model: string
): Promise<RawExtraction> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include content.');
  }

  let parsed: RawExtraction;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI response was not valid JSON.');
  }

  if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.decisions) || typeof parsed.summary !== 'string') {
    throw new Error('OpenAI response did not match the expected schema.');
  }

  return parsed;
}
