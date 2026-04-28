---
name: phase-self-check
description: Run the 6-question phase-end checklist when a logical phase completes (after a feature, before a context switch, or when the Stop hook prompts you). Use to surface skipped Iron Rules, missed memory writes, and overdue /compact opportunities.
---

# Phase-End Self-Check

Walk through these six questions. For each, answer "yes/no/n-a" and act on the "yes" answers before moving on.

1. **Iron-1 trigger**: Did the user's most recent intent contain "逐個 / 仔細 / 全部 / 不要省略 / thoroughly / each / all / every", or was the task security-related? If yes → for the rest of this work, no shortcuts.

2. **Subagent hygiene (Iron-2)**: Did you call a subagent in this phase, or are you about to? If yes → confirm the prompt has both: (a) a word cap appropriate to the depth (≤200 / ≤800 / ≤2000) and (b) an escape clause "but report anomalies in full regardless of cap".

3. **Repeated edits (Iron-3)**: Did you make the same string edit twice or more? If yes → switch to `perl -i -pe 's|old|new|g' files...` and run `git diff`.

4. **Templating (Habit)**: Did you plan N similar tasks? If yes → look for the largest common factor; if templatable, validate on one sample before bulk producing.

5. **Context size**: Is the conversation context noticeably large or are you crossing a phase boundary? If yes → consider `/compact` to drop early raw output.

6. **Memory candidate**: Is there an observation from this phase worth long-term memory — a rule learned, a decision rationale, an external resource pointer, a project-state change? If yes → write it as a feedback / project / reference memory, with a "why" line so future sessions can judge if it's still load-bearing.

## How to use the result

- If all "no" → continue.
- If any "yes" → take the corresponding action before proceeding. The Stop hook surfaces this checklist automatically; you can also invoke this skill any time with `/skill phase-self-check`.
