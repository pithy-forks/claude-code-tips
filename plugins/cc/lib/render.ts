// tested with: claude code v2.1.118
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
  // v3.3: false when the peer is visible via ~/.claude/sessions/<pid>.json
  // but cc's MCP server isn't up in that terminal yet (typical on the first
  // install before the user reloads other terminals).
  cc_loaded?: boolean;
  // v3.4: peer intent summary fields. branch is the peer's current git
  // branch (null on native-only peers). summary is a one-line synthesis
  // (latest <30min announcement, else most-recent-touched-file basename,
  // else "(idle)"). last_edit_age_s + last_announce_age_s let the renderer
  // pick the freshest signal for the parenthetical age.
  branch?: string | null;
  summary?: string | null;
  last_edit_age_s?: number | null;
  last_announce_age_s?: number | null;
};

export type OverlapAlert = {
  file: string;
  other_sessions: string[];
  // v3: structural reason for the alert. v2's both_touched_within_s
  // (10-min sliding window) is gone; alerts now fire on shared substrate
  // (same git branch and/or same worktree) regardless of timing.
  reason: "same-branch" | "same-worktree" | "same-branch+worktree";
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
    const ccLoadedCount = d.session_digests.filter(
      (s) => s.cc_loaded !== false,
    ).length;
    const nativeOnlyCount = d.session_digests.length - ccLoadedCount;
    lines.push(
      nativeOnlyCount > 0
        ? `activity (${ccLoadedCount} cc-loaded, ${nativeOnlyCount} need /reload-plugins):`
        : "activity:",
    );
    for (const s of d.session_digests) {
      const marker = s.cc_loaded === false ? " [no cc]" : "";
      // v3.4 intent line: prefer the synthesized peer summary + freshest age.
      // Falls back to the v3.3 cwd-only line for native-only peers, since
      // they have no cc-side activity to summarize.
      if (s.cc_loaded !== false && s.summary) {
        // pick freshest age: announce age if announce drove the summary, else edit age
        const driverAge =
          s.last_announce_age_s != null && s.last_announce_age_s < 30 * 60
            ? s.last_announce_age_s
            : s.last_edit_age_s ?? null;
        const ageStr = driverAge != null ? ` (${formatAge(driverAge)} ago)` : "";
        const branchStr = s.branch ? ` ${s.branch}` : "";
        lines.push(`- ${s.session}${branchStr} · ${previewOf(s.summary, 100)}${ageStr}`);
      } else {
        lines.push(`- ${s.session} @ ${shortPath(s.cwd)}${marker}`);
      }
    }
  }

  if (d.file_overlap_alerts.length > 0) {
    lines.push("");
    lines.push("file overlap:");
    for (const o of d.file_overlap_alerts) {
      const others = o.other_sessions.join(", ");
      const reasonText =
        o.reason === "same-branch+worktree"
          ? "same branch + worktree"
          : o.reason === "same-branch"
            ? "same branch"
            : "same worktree";
      lines.push(`- ${shortPath(o.file)}: also touched by ${others} (${reasonText}). coordinate via cc.send before continuing.`);
    }
  }

  return lines.join("\n");
}
