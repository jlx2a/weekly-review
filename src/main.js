/**
 * Personal weekly review. Runs as the Google account that authorizes it.
 *
 * Before the first run, open Project Settings → Script properties and add:
 *   GEMINI_API_KEY   key from Google AI Studio
 *   GEMINI_MODEL     optional, defaults to gemini-2.5-flash
 *   ROLE_NAME        optional
 *   ROLE_TITLE       optional
 *   ROLE_TEAM        optional
 *   ROLE_EMPHASIS    optional, what resume bullets should emphasize
 *
 * Run runWeek once from the editor. That authorizes the script and installs
 * the Friday 4:00pm America/Denver trigger. Run installFridayTrigger later
 * if you need to recreate the trigger.
 *
 * To push this project: clasp login as your Workspace user, then
 * clasp create --type standalone --title "Weekly review" --rootDir .
 * and clasp push.
 *
 * The script does not send mail to other people and does not post chat messages.
 */

var TIMEZONE = 'America/Denver';

function runWeek() {
  ensureFridayTrigger();
  var window = weekWindow(new Date());
  var corpus = collectWeek(window);
  var review = corpus.text ? summarizeWeek(corpus, window) : quietReview();
  publishWeek(review, window, corpus);
}

function installFridayTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runWeek') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  createFridayTrigger();
}

function ensureFridayTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runWeek') return;
  }
  createFridayTrigger();
}

function createFridayTrigger() {
  ScriptApp.newTrigger('runWeek')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(16)
    .nearMinute(0)
    .inTimezone(TIMEZONE)
    .create();
}

function weekWindow(now) {
  var today = dateParts(now);
  var monday = addCalendarDays(today.year, today.month, today.day, -(today.weekday - 1));
  var start = parseDenver(monday.year, monday.month, monday.day, 0, 0, 0);
  return {
    start: start,
    end: now,
    label: formatLabel(start, now),
    gmailAfter: String(Math.floor(start.getTime() / 1000) - 1),
    gmailBefore: String(Math.floor(now.getTime() / 1000) + 120),
  };
}

function dateParts(date) {
  var parts = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd').split('-');
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
    weekday: Number(Utilities.formatDate(date, TIMEZONE, 'u')),
  };
}

function addCalendarDays(year, month, day, delta) {
  var utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function parseDenver(year, month, day, hour, minute, second) {
  var stamp =
    pad(year, 4) +
    '-' +
    pad(month, 2) +
    '-' +
    pad(day, 2) +
    'T' +
    pad(hour, 2) +
    ':' +
    pad(minute, 2) +
    ':' +
    pad(second, 2);
  return Utilities.parseDate(stamp, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function formatLabel(start, end) {
  var startText = Utilities.formatDate(start, TIMEZONE, 'MMM d');
  var sameMonth =
    Utilities.formatDate(start, TIMEZONE, 'yyyy-MM') === Utilities.formatDate(end, TIMEZONE, 'yyyy-MM');
  var endText = Utilities.formatDate(end, TIMEZONE, sameMonth ? 'd' : 'MMM d');
  return startText + ' – ' + endText;
}

function pad(value, width) {
  var text = String(value);
  while (text.length < width) text = '0' + text;
  return text;
}
