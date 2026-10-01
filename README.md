# Weekly review

A personal Google Apps Script that writes a Friday review of the work week. It runs as the Google account that authorizes it, in the `America/Denver` timezone.

## What it does

Each run covers Monday through the moment the script runs.

1. **Collect.** It reads the default calendar (up to 40 events you did not decline), recent Gmail (up to 25 threads, excluding spam and trash), and Drive files whose names contain “Notes by Gemini,” “Transcript,” or “Meeting notes” (up to 8 docs). The combined text is capped so a long week still fits in one review.
2. **Summarize.** It sends that evidence to Gemini and asks for JSON only: a recap, resume bullets grounded in what you actually did, ordered actions for the coming week, and up to five reply drafts. The model is told not to invent metrics, meetings, names, or commitments. If nothing comes back, it writes a short “quiet week” note instead.
3. **Publish.** It creates a Google Doc named `Weekly review — <dates>` in a Drive folder called `Weekly reviews`. Email drafts are saved in Gmail and are not sent. Chat drafts stay in the doc for you to paste. Resume bullets are also appended to a running `Resume log` doc in the same folder. You get one email, to yourself, with the doc link.

Actions are ordered by who is waiting, what is due soon, what unblocks your own later work, and then smaller cleanup.

The script does not email other people and does not post chat messages.

## When it runs

`runWeek` installs a time trigger for **Friday at 4:00pm America/Denver** the first time you run it from the editor. Run `installFridayTrigger` if you need to recreate that trigger.

## Setup

1. In the Apps Script project, open **Project Settings → Script properties** and add:

   | Property | Required | Purpose |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | yes | Key from Google AI Studio |
   | `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
   | `ROLE_NAME` | no | Your name, for the review voice |
   | `ROLE_TITLE` | no | Role used when writing resume bullets |
   | `ROLE_TEAM` | no | Team context |
   | `ROLE_EMPHASIS` | no | What resume bullets should emphasize |

2. Run `runWeek` once from the editor and approve the requested access: read calendar and Gmail, compose Gmail drafts, read and write Drive and Docs, install the trigger, call the Gemini API, and email yourself.

3. To update the script from this folder, sign in with clasp as the Workspace user that owns the project, then `clasp push`.

## Layout

- `src/main.js` — week window and Friday trigger
- `src/collect.js` — calendar, Gmail, and meeting notes
- `src/summarize.js` — Gemini prompt and JSON parsing
- `src/publish.js` — Drive doc, resume log, Gmail drafts, and the email to yourself
