var FOLDER_NAME = 'Weekly reviews';
var RESUME_LOG_NAME = 'Resume log';

function publishWeek(review, window, corpus) {
  var folder = weeklyFolder();
  var draftResults = createEmailDrafts(review.drafts || []);
  var doc = DocumentApp.create('Weekly review — ' + window.label);
  DriveApp.getFileById(doc.getId()).moveTo(folder);
  writeReview(doc, review, window, corpus, draftResults);
  appendResumeLog(folder, window.label, review.resumeBullets || []);
  notifySelf(doc, window, draftResults);
  return doc.getUrl();
}

function weeklyFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function writeReview(doc, review, window, corpus, draftResults) {
  var body = doc.getBody();
  var first = body.getChild(0).asParagraph();
  first.setText('Weekly review — ' + window.label);
  first.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  body.appendParagraph(review.recap.headline || 'Weekly review');
  body.appendParagraph(countLine(corpus)).editAsText().setItalic(true);

  if (corpus.warnings && corpus.warnings.length) {
    body.appendParagraph('Some sources were skipped. ' + corpus.warnings.join(' '));
  }

  appendHeading(body, 'Recap', DocumentApp.ParagraphHeading.HEADING2);
  narrativeParagraphs(review.recap.narrative).forEach(function (paragraph) {
    body.appendParagraph(paragraph);
  });
  if (review.recap.highlights && review.recap.highlights.length) {
    review.recap.highlights.forEach(function (item) {
      body.appendListItem(item).setGlyphType(DocumentApp.GlyphType.BULLET);
    });
  }

  appendHeading(body, 'Resume bullets', DocumentApp.ParagraphHeading.HEADING2);
  if (!review.resumeBullets || !review.resumeBullets.length) {
    body.appendParagraph('No resume notes for this week.');
  } else {
    review.resumeBullets.forEach(function (item) {
      var text = item.bullet;
      if (item.evidence) text += '\n' + item.evidence;
      body.appendListItem(text).setGlyphType(DocumentApp.GlyphType.BULLET);
    });
  }

  appendHeading(body, 'Next week', DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Tackle these in this order. People waiting, and anything due soon, come before cleanup.');
  if (!review.actions || !review.actions.length) {
    body.appendParagraph('No open actions for this week.');
  } else {
    review.actions.forEach(function (action) {
      var text = action.title + '\n' + action.whyNow;
      text += '\n' + action.urgency + ' urgency · ' + action.effort + ' effort';
      if (action.source) text += '\n' + action.source;
      body.appendListItem(text).setGlyphType(DocumentApp.GlyphType.NUMBER);
    });
  }

  appendHeading(body, 'Drafts', DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Email drafts are saved in Gmail and are not sent. Chat replies stay in this doc for you to paste.');
  writeDraftGroup(body, 'Email', draftResults.filter(isEmailResult));
  writeDraftGroup(body, 'Chat', draftResults.filter(isChatResult));
}

function writeDraftGroup(body, title, results) {
  appendHeading(body, title, DocumentApp.ParagraphHeading.HEADING3);
  if (!results.length) {
    body.appendParagraph('None.');
    return;
  }
  results.forEach(function (result) {
    var draft = result.draft;
    var heading = draft.subject || draft.to || 'Draft';
    body.appendParagraph(heading).editAsText().setBold(true);
    if (draft.to) body.appendParagraph('To: ' + draft.to);
    body.appendParagraph(result.note);
    if (draft.reason) body.appendParagraph(draft.reason).editAsText().setItalic(true);
    body.appendParagraph(draft.body || '');
  });
}

function createEmailDrafts(drafts) {
  return drafts.map(function (draft) {
    if (draft.channel === 'chat') {
      return { draft: draft, saved: false, note: 'Paste this into chat. It was not sent.' };
    }
    var to = String(draft.to || '').trim();
    if (!to || to.indexOf('@') === -1) {
      return {
        draft: draft,
        saved: false,
        note: 'Left in this doc because there is no email address to save a Gmail draft.',
      };
    }
    try {
      GmailApp.createDraft(to, draft.subject || '', draft.body || '');
      return { draft: draft, saved: true, note: 'Saved in Gmail drafts. Not sent.' };
    } catch (error) {
      return { draft: draft, saved: false, note: 'Could not save the Gmail draft. ' + error.message };
    }
  });
}

function appendResumeLog(folder, label, bullets) {
  if (!bullets.length) return;
  var files = folder.getFilesByName(RESUME_LOG_NAME);
  var doc;
  if (files.hasNext()) {
    doc = DocumentApp.openById(files.next().getId());
  } else {
    doc = DocumentApp.create(RESUME_LOG_NAME);
    DriveApp.getFileById(doc.getId()).moveTo(folder);
    var title = doc.getBody().getChild(0).asParagraph();
    title.setText(RESUME_LOG_NAME);
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  }
  var body = doc.getBody();
  appendHeading(body, label, DocumentApp.ParagraphHeading.HEADING2);
  bullets.forEach(function (item) {
    var text = item.bullet;
    if (item.evidence) text += '\n' + item.evidence;
    body.appendListItem(text).setGlyphType(DocumentApp.GlyphType.BULLET);
  });
}

function notifySelf(doc, window, draftResults) {
  var me = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  if (!me) return;
  var saved = draftResults.filter(function (result) {
    return result.saved;
  }).length;
  var body =
    'Your weekly review for ' +
    window.label +
    ' is ready.\n\n' +
    doc.getUrl() +
    '\n\n' +
    saved +
    ' email draft' +
    (saved === 1 ? '' : 's') +
    ' saved in Gmail. Nothing was sent. Chat replies, if any, are in the doc.';
  MailApp.sendEmail(me, 'Weekly review — ' + window.label, body);
}

function appendHeading(body, text, heading) {
  body.appendParagraph(text).setHeading(heading);
}

function narrativeParagraphs(narrative) {
  return String(narrative || '')
    .split(/\n+/)
    .map(function (paragraph) {
      return paragraph.trim();
    })
    .filter(Boolean);
}

function countLine(corpus) {
  var counts = corpus.counts || { meetings: 0, emails: 0, notes: 0 };
  return counts.meetings + ' meetings · ' + counts.emails + ' emails · ' + counts.notes + ' note docs';
}

function isEmailResult(result) {
  return result.draft.channel !== 'chat';
}

function isChatResult(result) {
  return result.draft.channel === 'chat';
}
