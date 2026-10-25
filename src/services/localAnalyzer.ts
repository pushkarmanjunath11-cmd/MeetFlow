import type { MeetingMeta, RawExtraction } from '../types';

interface SpeakerLine {
  speaker: string | null;
  text: string;
}

const DECISION_KEYWORDS =
  /\b(decided|decision made|we'll go with|agreed|that's final|final decision|confirmed|resolved|let's go with)\b/i;

const ACTION_KEYWORDS =
  /\b(I'll|I will|will own|needs to|need to|should own|should take|action item|todo|to-do|can you|could you|has to|going to|can take|can own)\b/i;

const NOISE_PATTERN =
  /\b(not sure|unclear|let's figure that out|let's leave that|good question|we'll confirm)\b/i;

const DEADLINE_PATTERNS = [
  /\bby\s+([^,.!?;]+)/i,
  /\b(today|tomorrow|end of (?:day|week|month)|EOD|EOW|next (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
];

function parseMeta(lines: string[]): { meta: MeetingMeta; bodyStartIndex: number } {
  let title = 'Untitled Meeting';
  let date: string | null = null;
  let attendees: string[] = [];
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const titleMatch = line.match(/^meeting:\s*(.+)$/i);
    const dateMatch = line.match(/^date:\s*(.+)$/i);
    const attendeesMatch = line.match(/^attendees:\s*(.+)$/i);

    if (titleMatch) {
      title = titleMatch[1].trim();
      bodyStartIndex = i + 1;
    } else if (dateMatch) {
      date = dateMatch[1].trim();
      bodyStartIndex = i + 1;
    } else if (attendeesMatch) {
      attendees = attendeesMatch[1]
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      bodyStartIndex = i + 1;
    } else if (line === '') {
      if (bodyStartIndex === i) bodyStartIndex = i + 1;
    } else if (/^[A-Za-z][\w'. -]{0,30}:\s*/.test(line)) {
      // Reached dialogue, stop scanning headers
      break;
    }
  }

  return { meta: { title, date, attendees }, bodyStartIndex };
}

function parseSpeakerLines(lines: string[]): SpeakerLine[] {
  const result: SpeakerLine[] = [];
  const speakerRegex = /^([A-Za-z][\w'. -]{0,30}):\s*(.*)$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(speakerRegex);
    if (match) {
      result.push({ speaker: match[1].trim(), text: match[2].trim() });
    } else {
      result.push({ speaker: null, text: line });
    }
  }
  return result;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractDeadline(sentence: string): string | null {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      return (match[1] ?? match[0]).trim().replace(/\s+/g, ' ');
    }
  }
  return null;
}

function extractOwner(sentence: string, speaker: string | null, knownNames: string[]): string | null {
  const directAddress = sentence.match(/^([A-Z][a-zA-Z]+),\s*/);
  if (directAddress && knownNames.includes(directAddress[1])) {
    return directAddress[1];
  }

  if (/\bI('ll| will)\b/i.test(sentence) && speaker) {
    return speaker;
  }

  const nameWill = sentence.match(
    /\b([A-Z][a-zA-Z]+)\s+(?:will|needs to|should|is going to|can take|can own)\b/
  );
  if (nameWill && knownNames.includes(nameWill[1])) {
    return nameWill[1];
  }

  if (/\bcan take\b|\bcan own\b/i.test(sentence) && speaker) {
    return speaker;
  }

  return null;
}

function cleanDescription(sentence: string): string {
  return sentence
    .replace(/^([A-Z][a-zA-Z]+),\s*/, '')
    .replace(/\?+$/, '.')
    .trim();
}

export function analyzeLocally(transcript: string): RawExtraction {
  const lines = transcript.split('\n');
  const { meta, bodyStartIndex } = parseMeta(lines);
  const bodyLines = lines.slice(bodyStartIndex);
  const speakerLines = parseSpeakerLines(bodyLines);

  const detectedNames = new Set<string>(meta.attendees);
  for (const sl of speakerLines) {
    if (sl.speaker) detectedNames.add(sl.speaker);
  }
  const knownNames = Array.from(detectedNames);

  const decisions: string[] = [];
  const tasks: RawExtraction['tasks'] = [];

  for (const { speaker, text } of speakerLines) {
    const sentences = splitIntoSentences(text);
    for (const sentence of sentences) {
      if (NOISE_PATTERN.test(sentence)) continue;

      const isDecision = DECISION_KEYWORDS.test(sentence);
      const isAction = ACTION_KEYWORDS.test(sentence);

      if (isDecision) {
        decisions.push(sentence.replace(/^(great,?|correct,?|alright,?)\s*/i, '').trim());
      }

      if (isAction) {
        const owner = extractOwner(sentence, speaker, knownNames);
        const deadline = extractDeadline(sentence);
        const description = cleanDescription(sentence);
        if (description.length > 3) {
          tasks.push({ description, owner, deadline });
        }
      }
    }
  }

  const dedupedDecisions = Array.from(new Set(decisions)).filter((d) => d.length > 4);

  const summaryParts: string[] = [];
  summaryParts.push(
    `"${meta.title}"${meta.date ? ` (${meta.date})` : ''} covered ${speakerLines.length} discussion turns` +
      `${meta.attendees.length ? ` among ${meta.attendees.join(', ')}` : ''}.`
  );
  summaryParts.push(
    `The team reached ${dedupedDecisions.length} key decision(s) and identified ${tasks.length} action item(s).`
  );
  const missing = tasks.filter((t) => !t.owner || !t.deadline).length;
  if (missing > 0) {
    summaryParts.push(`${missing} action item(s) are missing an owner and/or deadline and need clarification.`);
  }

  return {
    summary: summaryParts.join(' '),
    decisions: dedupedDecisions,
    tasks,
  };
}

export function extractMeta(transcript: string): MeetingMeta {
  const { meta } = parseMeta(transcript.split('\n'));
  return meta;
}

/** Union of explicitly declared attendees and speakers detected in the dialogue, case-insensitively deduped. */
export function extractAttendees(transcript: string): string[] {
  const lines = transcript.split('\n');
  const { meta, bodyStartIndex } = parseMeta(lines);
  const bodyLines = lines.slice(bodyStartIndex);
  const speakerLines = parseSpeakerLines(bodyLines);

  const seen = new Map<string, string>();
  const addName = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  };

  meta.attendees.forEach(addName);
  speakerLines.forEach((sl) => {
    if (sl.speaker) addName(sl.speaker);
  });

  return Array.from(seen.values());
}
