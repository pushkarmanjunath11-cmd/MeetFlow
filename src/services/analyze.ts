import type {
  AmbiguousReason,
  AppSettings,
  ExtractedTask,
  FollowUpQuestion,
  MeetingAnalysis,
  RawExtraction,
} from '../types';
import { analyzeLocally, extractAttendees, extractMeta } from './localAnalyzer';
import { analyzeWithOpenAI } from './openaiProvider';
import { parseMeetingDateToIso, validateDeadline, validateOwner } from './validation';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function computeReasons(owner: string | null, deadline: string | null): AmbiguousReason[] {
  const reasons: AmbiguousReason[] = [];
  if (!owner) reasons.push('missing-owner');
  if (!deadline) reasons.push('missing-deadline');
  return reasons;
}

function buildTasksAndFollowUps(
  raw: RawExtraction,
  attendees: string[],
  meetingDateIso: string | null
): { tasks: ExtractedTask[]; followUps: FollowUpQuestion[] } {
  const tasks: ExtractedTask[] = [];
  const followUps: FollowUpQuestion[] = [];

  for (const t of raw.tasks) {
    // Auto-extracted owner/deadline values are heuristic guesses, not user input — they still
    // must pass the same validation before being treated as resolved, so an invalid or
    // unrecognized extraction correctly falls back to "missing" instead of displaying as fact.
    let owner: string | null = null;
    if (t.owner) {
      const result = validateOwner(t.owner, attendees);
      if (result.ok) owner = result.value;
    }

    let deadline: string | null = null;
    if (t.deadline) {
      const result = validateDeadline(t.deadline, { meetingDateIso });
      if (result.ok) deadline = result.value;
    }

    const reasons = computeReasons(owner, deadline);
    const taskId = nextId('task');
    tasks.push({
      id: taskId,
      description: t.description,
      owner,
      deadline,
      status: reasons.length ? 'ambiguous' : 'complete',
      ambiguousReasons: reasons,
    });

    if (reasons.includes('missing-owner')) {
      followUps.push({
        id: nextId('fu'),
        taskId,
        field: 'owner',
        question: `Who should own: "${t.description}"?`,
        answer: '',
        answered: false,
      });
    }
    if (reasons.includes('missing-deadline')) {
      followUps.push({
        id: nextId('fu'),
        taskId,
        field: 'deadline',
        question: `What is the deadline for: "${t.description}"?`,
        answer: '',
        answered: false,
      });
    }
  }

  return { tasks, followUps };
}

export async function runAnalysis(
  transcript: string,
  settings: AppSettings
): Promise<MeetingAnalysis> {
  const meta = extractMeta(transcript);
  const attendees = extractAttendees(transcript);
  const meetingDateIso = parseMeetingDateToIso(meta.date);

  let raw: RawExtraction;
  let provider: 'demo' | 'openai' = 'demo';
  let warning: string | undefined;

  if (settings.openaiApiKey.trim()) {
    try {
      raw = await analyzeWithOpenAI(transcript, settings.openaiApiKey.trim(), settings.model || 'gpt-4o-mini');
      provider = 'openai';
    } catch (err) {
      warning = `OpenAI analysis failed, fell back to local demo mode: ${
        err instanceof Error ? err.message : String(err)
      }`;
      raw = analyzeLocally(transcript);
      provider = 'demo';
    }
  } else {
    raw = analyzeLocally(transcript);
  }

  const { tasks, followUps } = buildTasksAndFollowUps(raw, attendees, meetingDateIso);
  const decisions = raw.decisions.map((text) => ({ id: nextId('dec'), text }));
  const now = new Date().toISOString();

  return {
    id: nextId('analysis'),
    createdAt: now,
    updatedAt: now,
    transcript,
    meta,
    summary: raw.summary,
    decisions,
    tasks,
    followUps,
    provider,
    warning,
  };
}

export interface MutationResult {
  analysis: MeetingAnalysis;
  error: string | null;
}

/**
 * Validates `answer` against the follow-up's expected type (owner or deadline) before touching
 * any state. On failure, returns the original analysis unchanged plus an error message; on
 * success, the task's completion status is still derived solely from whether BOTH owner and
 * deadline are now present — answering one question never marks a task complete by itself.
 */
export function applyFollowUpAnswer(
  analysis: MeetingAnalysis,
  followUpId: string,
  answer: string
): MutationResult {
  const followUp = analysis.followUps.find((fu) => fu.id === followUpId);
  if (!followUp) return { analysis, error: null };

  const attendees = extractAttendees(analysis.transcript);
  const meetingDateIso = parseMeetingDateToIso(analysis.meta.date);

  const result =
    followUp.field === 'owner'
      ? validateOwner(answer, attendees)
      : validateDeadline(answer, { meetingDateIso });

  if (!result.ok) {
    return { analysis, error: result.error };
  }

  // Preserve exactly what the user typed on the question (for reference) while the task itself
  // stores the normalized/canonical value. For owners the normalized value IS the reference.
  const referenceAnswer = followUp.field === 'owner' ? result.value : answer.trim();

  const followUps = analysis.followUps.map((fu) =>
    fu.id === followUpId ? { ...fu, answer: referenceAnswer, answered: true } : fu
  );

  const tasks = analysis.tasks.map((task) => {
    if (task.id !== followUp.taskId) return task;
    const updated: ExtractedTask = { ...task, [followUp.field]: result.value };
    const reasons = computeReasons(updated.owner, updated.deadline);
    updated.ambiguousReasons = reasons;
    updated.status = reasons.length ? 'ambiguous' : 'complete';
    return updated;
  });

  return {
    analysis: { ...analysis, tasks, followUps, updatedAt: new Date().toISOString() },
    error: null,
  };
}

/**
 * Direct table edits go through the same validation as clarification answers. Clearing a field
 * back to empty is allowed without validation (it represents "still unknown", not a new claim).
 * An invalid value never touches the task or localStorage-backed state.
 */
export function updateTaskField(
  analysis: MeetingAnalysis,
  taskId: string,
  field: 'owner' | 'deadline',
  value: string
): MutationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    const tasks = analysis.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const updated: ExtractedTask = { ...task, [field]: null };
      const reasons = computeReasons(updated.owner, updated.deadline);
      updated.ambiguousReasons = reasons;
      updated.status = reasons.length ? 'ambiguous' : 'complete';
      return updated;
    });
    const followUps = analysis.followUps.map((fu) =>
      fu.taskId === taskId && fu.field === field ? { ...fu, answer: '', answered: false } : fu
    );
    return {
      analysis: { ...analysis, tasks, followUps, updatedAt: new Date().toISOString() },
      error: null,
    };
  }

  const attendees = extractAttendees(analysis.transcript);
  const meetingDateIso = parseMeetingDateToIso(analysis.meta.date);
  const result = field === 'owner' ? validateOwner(trimmed, attendees) : validateDeadline(trimmed, { meetingDateIso });

  if (!result.ok) {
    return { analysis, error: result.error };
  }

  const referenceAnswer = field === 'owner' ? result.value : trimmed;

  const tasks = analysis.tasks.map((task) => {
    if (task.id !== taskId) return task;
    const updated: ExtractedTask = { ...task, [field]: result.value };
    const reasons = computeReasons(updated.owner, updated.deadline);
    updated.ambiguousReasons = reasons;
    updated.status = reasons.length ? 'ambiguous' : 'complete';
    return updated;
  });

  const followUps = analysis.followUps.map((fu) =>
    fu.taskId === taskId && fu.field === field ? { ...fu, answer: referenceAnswer, answered: true } : fu
  );

  return {
    analysis: { ...analysis, tasks, followUps, updatedAt: new Date().toISOString() },
    error: null,
  };
}
