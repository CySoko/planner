// Setup.gs — run setupSheet() once from the Apps Script editor.
// Safe to run again: it only adds what is missing and never touches existing rows or columns.

function setupSheet(ss) {
  const S = (typeof module !== 'undefined') ? require('./Schema.js') : { HEADERS, DEFAULT_CONTEXT, DEFAULT_QUOTES };
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const created = [];

  Object.keys(S.HEADERS).forEach((tab) => {
    const cols = S.HEADERS[tab];
    let sheet = ss.getSheetByName(tab);
    if (!sheet) { sheet = ss.insertSheet(tab); created.push(tab); }
    if (sheet.getLastRow() === 0) {
      const header = sheet.getRange(1, 1, 1, cols.length);
      header.setValues([cols]);
      header.setFontWeight('bold');
    } else {
      // Add any new columns at the END, only if the existing headers match the start of the list.
      const have = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].filter(String);
      const prefixOk = have.every((h, i) => h === cols[i]);
      if (!prefixOk) throw new Error('Headers on "' + tab + '" do not match Schema. Fix by hand; nothing was changed.');
      if (have.length < cols.length) {
        const extra = sheet.getRange(1, have.length + 1, 1, cols.length - have.length);
        extra.setValues([cols.slice(have.length)]);
        extra.setFontWeight('bold');
        created.push(tab + ' (+' + (cols.length - have.length) + ' columns)');
      }
    }
    sheet.setFrozenRows(1);
    // Plain text everywhere, so Sheets never turns ids or dates into date values.
    sheet.getRange(1, 1, sheet.getMaxRows(), cols.length).setNumberFormat('@');
  });

  seedIfEmpty_(ss.getSheetByName('Context'), S.DEFAULT_CONTEXT);
  seedIfEmpty_(ss.getSheetByName('Quotes'), S.DEFAULT_QUOTES);

  // Remove Google's blank starter tab, only if it is truly empty.
  const starter = ss.getSheetByName('Sheet1');
  if (starter && starter.getLastRow() === 0 && !S.HEADERS.Sheet1) ss.deleteSheet(starter);

  const msg = created.length ? 'Created tabs: ' + created.join(', ') : 'All tabs already existed. Nothing changed.';
  if (typeof Logger !== 'undefined') Logger.log(msg);
  return msg;
}

function seedIfEmpty_(sheet, rows) {
  if (!sheet || sheet.getLastRow() !== 1 || !rows.length) return;
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

if (typeof module !== 'undefined') module.exports = { setupSheet };
