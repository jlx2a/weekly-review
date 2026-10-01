function quietReview() {
  return {
    recap: {
      headline: 'This window is quiet.',
      narrative:
        'No meetings, mail, or meeting notes came back for these dates. If that seems wrong, confirm this script is running as the account that owns the calendar.',
      highlights: [],
    },
    resumeBullets: [],
    actions: [],
    drafts: [],
  };
}

function summarizeWeek(corpus, window) {
  var raw = callGemini(buildPrompt(window.label, corpus.text));
  return parseModelOutput(raw);
}

function buildPrompt(weekLabel, evidence) {
  var who = roleNote();
  return (
    'You are preparing a personal weekly review. Week of ' +
    weekLabel +
    '.\n' +
    (who || 'The user did not add a role profile. Keep resume bullets general and evidence-based.') +
    '\n\n' +
    'Use only the evidence below. Do not invent metrics, meetings, names, or commitments.\n' +
    'Ignore newsletters, promotions, and automated notifications unless the user clearly has to act.\n' +
    'Write in plain English.\n\n' +
    'Resume bullets start with a verb, describe work the user actually did, and stay suitable to paste into a resume later. If the evidence has no outcome, do not invent one. Include 3 to 6 bullets when the week supports them, fewer when it does not.\n\n' +
    'Order actions for the coming week:\n' +
    '1. Someone is waiting on the user, or a deadline is inside the next few days.\n' +
    '2. A reply or follow-up the user promised.\n' +
    '3. Work that unblocks the user\'s own later tasks.\n' +
    '4. Smaller cleanup.\n' +
    'Do not assign tasks that belong to someone else. urgency is high, medium, or low. effort is small, medium, or large. order starts at 1.\n\n' +
    'Draft a message only when the user owes a reply or promised a follow-up. Maximum 5 drafts. Email drafts need a subject and an email address in "to" when the evidence includes one. Chat drafts use channel "chat", an empty subject, and a short conversational body. Do not claim a message was sent.\n\n' +
    'Return JSON only:\n' +
    '{\n' +
    '  "recap": { "headline": string, "narrative": string, "highlights": string[] },\n' +
    '  "resumeBullets": [{ "bullet": string, "evidence": string }],\n' +
    '  "actions": [{ "title": string, "whyNow": string, "order": number, "urgency": "high"|"medium"|"low", "effort": "small"|"medium"|"large", "source": string }],\n' +
    '  "drafts": [{ "channel": "email"|"chat", "to": string, "subject": string, "body": string, "reason": string }]\n' +
    '}\n\n' +
    'Evidence:\n' +
    evidence
  );
}

function roleNote() {
  var props = PropertiesService.getScriptProperties();
  var lines = [];
  var name = props.getProperty('ROLE_NAME');
  var title = props.getProperty('ROLE_TITLE');
  var team = props.getProperty('ROLE_TEAM');
  var emphasis = props.getProperty('ROLE_EMPHASIS');
  if (name) lines.push('Name: ' + name);
  if (title) lines.push('Role: ' + title);
  if (team) lines.push('Team: ' + team);
  if (emphasis) lines.push('What resume bullets should emphasize: ' + emphasis);
  return lines.join('\n');
}

function callGemini(prompt) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('Add GEMINI_API_KEY in Project Settings, Script properties.');
  }
  var model = props.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent?key=' +
    encodeURIComponent(key);
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  var code = response.getResponseCode();
  var body = {};
  try {
    body = JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    body = {};
  }
  if (code < 200 || code >= 300) {
    var message = body.error && body.error.message ? body.error.message : 'Gemini request failed (' + code + ').';
    throw new Error(message);
  }
  var parts =
    body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
  var text = (parts || [])
    .map(function (part) {
      return part.text || '';
    })
    .join('\n');
  if (!text) throw new Error('Gemini returned an empty review.');
  return text;
}

function parseModelOutput(text) {
  var raw = extractJson(text);
  var recap = raw.recap || {};
  var actions = (Array.isArray(raw.actions) ? raw.actions : []).map(function (item, index) {
    var row = item || {};
    var order = Number(row.order);
    return {
      title: asString(row.title, 'Untitled action'),
      whyNow: asString(row.whyNow),
      order: isFinite(order) && order > 0 ? order : index + 1,
      urgency: row.urgency === 'high' || row.urgency === 'low' ? row.urgency : 'medium',
      effort: row.effort === 'small' || row.effort === 'large' ? row.effort : 'medium',
      source: asString(row.source),
    };
  });
  actions.sort(function (a, b) {
    return a.order - b.order;
  });

  return {
    recap: {
      headline: asString(recap.headline, 'Weekly review'),
      narrative: asString(recap.narrative),
      highlights: asStringList(recap.highlights),
    },
    resumeBullets: (Array.isArray(raw.resumeBullets) ? raw.resumeBullets : [])
      .map(function (item) {
        var row = item || {};
        return { bullet: asString(row.bullet), evidence: asString(row.evidence) };
      })
      .filter(function (item) {
        return item.bullet;
      }),
    actions: actions,
    drafts: (Array.isArray(raw.drafts) ? raw.drafts : [])
      .map(function (item) {
        var row = item || {};
        return {
          channel: row.channel === 'chat' ? 'chat' : 'email',
          to: asString(row.to),
          subject: asString(row.subject),
          body: asString(row.body),
          reason: asString(row.reason),
        };
      })
      .filter(function (item) {
        return item.body;
      })
      .slice(0, 5),
  };
}

function extractJson(text) {
  var trimmed = String(text || '').trim();
  var fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  var body = fenced ? fenced[1].trim() : trimmed;
  var start = body.indexOf('{');
  var end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The model did not return JSON.');
  return JSON.parse(body.slice(start, end + 1));
}

function asString(value, fallback) {
  if (fallback === undefined) fallback = '';
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function (item) {
      return asString(item);
    })
    .filter(Boolean);
}
