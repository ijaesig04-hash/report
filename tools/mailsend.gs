/* 에스원 다이렉트몰 홍보메일 — 디자인 그대로 발송 (구글 Apps Script 웹 앱)
   배포: 배포 → 새 배포 → 유형 '웹 앱' → 실행: 나 / 액세스: 모든 사용자 */
const KEY = 's1-bukseoul-mail';
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.key !== KEY) return out({ ok: false, err: 'key' });
    const to = String(d.to || '').split(/[,;\s]+/).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (!to.length || to.length > 10) return out({ ok: false, err: 'to' });
    const inline = {};
    (d.imgs || []).slice(0, 5).forEach((b64, i) => {
      inline['img' + i] = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'img' + i + '.jpg');
    });
    const opt = { htmlBody: String(d.html || ''), name: String(d.name || '에스원').slice(0, 40), inlineImages: inline };
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.replyTo || '')) opt.replyTo = d.replyTo;
    MailApp.sendEmail(to.join(','), String(d.subject || '에스원 다이렉트몰 안내').slice(0, 200), String(d.text || ''), opt);
    return out({ ok: true, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  }
}
function doGet() { return out({ ok: true, left: MailApp.getRemainingDailyQuota() }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
