var MAX_CORPUS_CHARS = 60000;

function collectWeek(window) {
  var warnings = [];
  var blocks = [];
  var counts = { meetings: 0, emails: 0, notes: 0 };

  try {
    collectCalendar(window, blocks, counts);
  } catch (error) {
    warnings.push('Calendar could not be read. ' + error.message);
  }

  try {
    collectGmail(window, blocks, counts);
  } catch (error) {
    warnings.push('Gmail could not be read. ' + error.message);
  }

  try {
    collectNotes(window, blocks, counts);
  } catch (error) {
    warnings.push('Meeting notes could not be read. ' + error.message);
  }

  var text = blocks.join('\n\n');
  if (text.length > MAX_CORPUS_CHARS) {
    text = text.slice(0, MAX_CORPUS_CHARS);
    warnings.push('The week was long, so older excerpts were shortened before the review was written.');
  }

  if (text) {
    text =
      'Current time: ' +
      new Date().toISOString() +
      '\nCalendar events after the current time are upcoming. Do not treat them as work already finished.\n\n' +
      text;
  }

  return { text: text, counts: counts, warnings: warnings };
}

function collectCalendar(window, blocks, counts) {
  var events = CalendarApp.getDefaultCalendar().getEvents(window.start, window.end);
  var limit = Math.min(events.length, 40);
  for (var i = 0; i < limit; i++) {
    var event = events[i];
    if (event.getMyStatus() === CalendarApp.GuestStatus.NO) continue;
    var title = event.getTitle() || 'Untitled meeting';
    var when = Utilities.formatDate(event.getStartTime(), TIMEZONE, "EEE MMM d, h:mm a");
    var guests = event
      .getGuestList(true)
      .slice(0, 12)
      .map(function (guest) {
        return guest.getEmail();
      })
      .filter(Boolean)
      .join(', ');
    var description = clip(event.getDescription() || '', 700);
    counts.meetings++;
    blocks.push(
      [
        'MEETING: ' + title,
        'When: ' + when,
        guests ? 'People: ' + guests : '',
        description ? 'Description: ' + description : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

function collectGmail(window, blocks, counts) {
  var query = 'after:' + window.gmailAfter + ' before:' + window.gmailBefore + ' -in:spam -in:trash';
  var threads = GmailApp.search(query, 0, 25);
  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    var chosen = messages.length > 1 ? [messages[0], messages[messages.length - 1]] : messages.slice(0, 1);
    chosen.forEach(function (message) {
      var subject = message.getSubject() || '(no subject)';
      var when = Utilities.formatDate(message.getDate(), TIMEZONE, "EEE MMM d, h:mm a");
      var body = clip(message.getPlainBody() || message.getSnippet() || '', 1400);
      counts.emails++;
      blocks.push(
        'EMAIL: ' +
          subject +
          '\nFrom: ' +
          message.getFrom() +
          '\nTo: ' +
          message.getTo() +
          '\nDate: ' +
          when +
          '\n' +
          body,
      );
    });
  });
}

function collectNotes(window, blocks, counts) {
  var query = [
    "modifiedTime >= '" + window.start.toISOString() + "'",
    "modifiedTime <= '" + window.end.toISOString() + "'",
    'trashed = false',
    "(name contains 'Notes by Gemini' or name contains 'Transcript' or name contains 'Meeting notes')",
  ].join(' and ');
  var files = DriveApp.searchFiles(query);
  var seen = 0;
  var examined = 0;
  while (files.hasNext() && seen < 8 && examined < 30) {
    examined++;
    var file = files.next();
    var text = noteText(file);
    if (!text) continue;
    seen++;
    counts.notes++;
    var when = Utilities.formatDate(file.getLastUpdated(), TIMEZONE, 'EEE MMM d');
    blocks.push('NOTES: ' + file.getName() + '\nWhen: ' + when + '\n' + clip(text, 4000));
  }
}

function noteText(file) {
  var mime = file.getMimeType();
  if (mime === MimeType.GOOGLE_DOCS) {
    return DocumentApp.openById(file.getId()).getBody().getText();
  }
  if (mime === MimeType.PLAIN_TEXT) {
    return file.getBlob().getDataAsString();
  }
  return '';
}

function clip(value, max) {
  var trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + '…';
}
