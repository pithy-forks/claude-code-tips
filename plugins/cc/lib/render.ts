// Renders a Digest into a plain-text block suitable for hook additionalContext injection.
// Empty if nothing to say; caller skips the hook output when this returns "".

import * as os from "node:os";

export type DirectMsg = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  urgency: "low" | "normal" | "urgent" | "question";
  age_s: number;
};

export type TopicMsg = {
  from: string;
  subject: string;
  preview: string;
  age_s: number;
};

export type SessionDigest = {
  session: string;
  cwd: string;
  role?: string | null;
  recent_files: string[];
  last_announce?: { summary: string; age_s: number } | null;
};

export type OverlapAlert = {
  file: string;
  other_sessions: string[];
  both_touched_within_s: number;
};

export type QuestionAwaitingMe = {
  id: string;
  from: string;
  question: string;
  options?: string[];
  age_s: number;
  blocking: boolean;
};

export type Digest = {
  is_delta: boolean;
  active_session_count: number;
  direct_unread: DirectMsg[];
  topic_unread: Record<string, TopicMsg[]>;
  session_digests: SessionDigest[];
  file_overlap_alerts: OverlapAlert[];
  questions_awaiting_me: QuestionAwaitingMe[];
  my_open_questions: Array<{ id: string; to?: string | null; topic?: string | null; age_s: number }>;
};

const HOME = os.homedir();

function shortPath(p: string): string {
  if (p.startsWith(HOME)) return "~" + p.slice(HOME.length);
  return p;
}

function formatAge(age_s: number): string {
  if (age_s < 60) return `${Math.max(1, Math.round(age_s))}s`;
  if (age_s < 3600) return `${Math.round(age_s / 60)}m`;
  if (age_s < 86400) return `${Math.round(age_s / 3600)}h`;
  return `${Math.round(age_s / 86400)}d`;
}

function previewOf(s: string, max = 140): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "…";
}

export function renderDigest(d: Digest): string {
  const empty =
    d.direct_unread.length === 0 &&
    Object.keys(d.topic_unread).length === 0 &&
    d.session_digests.length === 0 &&
    d.file_overlap_alerts.length === 0 &&
    d.questions_awaiting_me.length === 0;
  if (empty) return "";

  const lines: string[] = [];
  const label = d.is_delta ? "update" : "digest";
  lines.push(`cc ${label} (${d.active_session_count} other ${d.active_session_count === 1 ? "session" : "sessions"} active)`);

  if (d.direct_unread.length > 0) {
    lines.push("");
    lines.push("direct:");
    for (const m of d.direct_unread) {
      const subj = m.subject ? `"${m.subject}"` : "";
      const tag = m.urgency !== "normal" ? `, ${m.urgency}` : "";
      lines.push(`- ${m.from} (${formatAge(m.age_s)}${tag}) ${subj}: ${previewOf(m.preview)}`);
    }
  }

  const topics = Object.keys(d.topic_unread);
  if (topics.length > 0) {
    lines.push("");
    for (const t of topics) {
      const msgs = d.topic_unread[t];
      lines.push(`topic ${t} (${msgs.length} new):`);
      for (const m of msgs) {
        const subj = m.subject ? `"${m.subject}"` : "";
        lines.push(`- ${m.from} (${formatAge(m.age_s)}) ${subj}: ${previewOf(m.preview)}`);
      }
    }
  }

  if (d.questions_awaiting_me.length > 0) {
    lines.push("");
    lines.push("questions awaiting you:");
    for (const q of d.questions_awaiting_me) {
      const opts = q.options && q.options.length > 0 ? ` options: ${q.options.join(" / ")}` : "";
      const blocker = q.blocking ? " [blocking]" : "";
      lines.push(`- ${q.id} from ${q.from}${blocker}: ${previewOf(q.question, 200)}${opts}`);
    }
  }

  if (d.session_digests.length > 0) {
    lines.push("");
    lines.push("activity:");
    for (const s of d.session_digests) {
      const files = s.recent_files.slice(0, 3).map((f) => shortPath(f)).join(", ");
      const filesStr = files ? ` (${files})` : "";
      const announce = s.last_announce
        ? `: ${previewOf(s.last_announce.summary, 160)} [${formatAge(s.last_announce.age_s)}]`
        : "";
      lines.push(`- ${s.session} @ ${shortPath(s.cwd)}${filesStr}${announce}`);
    }
  }

  if (d.file_overlap_alerts.length > 0) {
    lines.push("");
    lines.push("file overlap:");
    for (const o of d.file_overlap_alerts) {
      const others = o.other_sessions.join(", ");
      lines.push(`- ${shortPath(o.file)}: also touched by ${others} within ${formatAge(o.both_touched_within_s)}. coordinate via /cc send or /cc subscribe`);
    }
  }

  return lines.join("\n");
}
