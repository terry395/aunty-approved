/**
 * Aunty Approved · Google Apps Script order receiver
 * -------------------------------------------------
 * Paste this whole file into your Google Sheet:
 *   Extensions → Apps Script → replace everything in Code.gs → Save.
 * Then Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the Web app URL into ORDERS_SHEET_URL at the top of script.js.
 *
 * What it does:
 *   1. Adds a header row if the "Orders" sheet is empty.
 *   2. Appends one row per order.
 *   3. Emails the customer a simple confirmation (payment was a DEMO).
 */

const SHEET_NAME = "Orders";
const SHOP_NAME = "Aunty Approved";
const SEND_CONFIRMATION_EMAIL = true;   // set to false to stop sending emails

// [Column header, key in the order JSON sent by script.js]
const COLUMNS = [
  ["Timestamp (SGT)", "timestamp"],
  ["Order number", "orderNumber"],
  ["Customer name", "customerName"],
  ["Email", "email"],
  ["Mobile", "mobile"],
  ["Items", "items"],
  ["Subtotal", "subtotal"],
  ["Early-bird savings", "earlyBirdSavings"],
  ["Delivery fee", "deliveryFee"],
  ["Total", "total"],
  ["Address", "address"],
  ["Unit", "unit"],
  ["Postal code", "postalCode"],
  ["Delivery date", "deliveryDate"],
  ["Is gift", "isGift"],
  ["Recipient name", "recipientName"],
  ["Recipient mobile", "recipientMobile"],
  ["Gift message", "giftMessage"],
  ["Dialect", "dialect"],
  ["Family description", "familyDescription"],
  ["Marketing opt-in", "marketingOptIn"],
  ["Payment status", "paymentStatus"]
];

// Columns kept as plain text so leading zeros survive (e.g. postal code 018956)
const TEXT_KEYS = ["mobile", "postalCode", "unit", "recipientMobile", "orderNumber"];
const MONEY_KEYS = ["subtotal", "earlyBirdSavings", "deliveryFee", "total"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!data.orderNumber || !data.email) {
      return textOut("error: missing order number or email");
    }

    const sheet = getSheet_();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(COLUMNS.map(function (c) { return c[0]; }));
      sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold").setBackground("#FBE9C6");
      sheet.setFrozenRows(1);
    }

    // Use the server's clock for the timestamp (Singapore time)
    data.timestamp = Utilities.formatDate(new Date(), "Asia/Singapore", "yyyy-MM-dd HH:mm:ss");

    const row = COLUMNS.map(function (c) {
      const key = c[1];
      const v = data[key];
      if (MONEY_KEYS.indexOf(key) !== -1) return Number(v) || 0;
      return safeText_(v);
    });

    const rowIndex = sheet.getLastRow() + 1;
    // Format text columns before writing so Sheets doesn't strip leading zeros
    TEXT_KEYS.forEach(function (key) {
      const col = COLUMNS.findIndex(function (c) { return c[1] === key; }) + 1;
      if (col > 0) sheet.getRange(rowIndex, col).setNumberFormat("@");
    });
    MONEY_KEYS.forEach(function (key) {
      const col = COLUMNS.findIndex(function (c) { return c[1] === key; }) + 1;
      if (col > 0) sheet.getRange(rowIndex, col).setNumberFormat("0.00");
    });
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

    if (SEND_CONFIRMATION_EMAIL) {
      try { sendConfirmationEmail_(data); } catch (mailErr) { console.error("Email failed: " + mailErr); }
    }

    return textOut("ok");
  } catch (err) {
    console.error(err);
    return textOut("error: " + err);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Visiting the web app URL in a browser shows this, which is handy to check it's live.
function doGet() {
  return textOut("Aunty Approved order receiver is running. Orders are sent here by the website.");
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

// Stops customer text being treated as a spreadsheet formula (e.g. "=HYPERLINK(...)")
function safeText_(v) {
  if (v === null || v === undefined) return "";
  let s = String(v).slice(0, 1000);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function money_(n) {
  return "S$" + (Number(n) || 0).toFixed(2);
}

function sendConfirmationEmail_(d) {
  const lines = [
    "Hi " + (d.customerName || "there") + ",",
    "",
    "Aunty approves! Your order is in.",
    "",
    "Order number: " + d.orderNumber,
    "Items: " + d.items,
    "Subtotal: " + money_(d.subtotal) + (Number(d.earlyBirdSavings) > 0 ? " (you saved " + money_(d.earlyBirdSavings) + " with early-bird)" : ""),
    "Delivery: " + (Number(d.deliveryFee) === 0 ? "FREE" : money_(d.deliveryFee)),
    "Total: " + money_(d.total),
    "",
    "Delivery date: " + d.deliveryDate,
    "Deliver to: " + (d.isGift === "Yes" ? d.recipientName + ", " : "") + d.address + (d.unit ? ", " + d.unit : "") + ", Singapore " + d.postalCode,
    "",
    "Payment note: this was a DEMO payment. Aunty Approved is a student project and no money was charged.",
    "",
    "Questions? Just reply to this email.",
    "",
    "Gong xi fa cai!",
    SHOP_NAME
  ];
  MailApp.sendEmail({
    to: d.email,
    subject: SHOP_NAME + " order " + d.orderNumber + " confirmed",
    body: lines.join("\n"),
    name: SHOP_NAME
  });
}

function textOut(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}
