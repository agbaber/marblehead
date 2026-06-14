// meeting-digest/worker/src/lib/email-shell.js
//
// Shared chrome for every email the Worker sends: light/dark-aware page
// background, navy hero bar with the Marblehead Data wordmark + lighthouse
// favicon, a centered 600px content card, and an outer footer line.
//
// All callers pass the inner body markup (already styled) and the shell
// wraps it. Keep inline styles on every element so Gmail/Outlook don't
// strip them; the <style> block adds prefers-color-scheme overrides for
// the clients that respect it (Apple Mail, iOS Mail, some Outlook).

const LOGO_URL = 'https://marbleheaddata.org/favicon-192.png';

export function emailShell({ body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Marblehead Data</title>
<style>
  body, table, td, p, h1, h2, a { -webkit-text-size-adjust: 100%; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #0B1620 !important; color: #e7eaee !important; }
    .mhd-page { background-color: #0B1620 !important; }
    .mhd-card { background-color: #14222d !important; }
    .mhd-body, .mhd-body p, .mhd-body h1, .mhd-body h2 { color: #e7eaee !important; }
    .mhd-muted, .mhd-foot { color: #9aa3ac !important; }
    .mhd-hr { border-top-color: #2a3946 !important; }
    a.mhd-button { background-color: #2F7D8E !important; color: #ffffff !important; }
    a.mhd-link { color: #79c0d4 !important; }
  }
</style>
</head>
<body class="mhd-page" style="margin: 0; padding: 0; background-color: #F4F7FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F4F7FA;" class="mhd-page">
    <tr><td align="center" style="padding: 28px 14px 36px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="mhd-card" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
        <tr><td style="background-color: #1B3A57; padding: 18px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="padding-right: 12px;"><img src="${LOGO_URL}" alt="" width="28" height="28" style="display: block; border: 0; border-radius: 4px;"></td>
              <td valign="middle"><span style="font-size: 16px; font-weight: 600; color: #ffffff; letter-spacing: 0.01em;">Marblehead Data</span></td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="mhd-body" style="padding: 32px 28px 28px; color: #1a1a1a; line-height: 1.55;">
${body}
        </td></tr>
      </table>
      <p class="mhd-foot" style="margin: 14px 0 0; font-size: 12px; color: #8a949c;">marbleheaddata.org &nbsp;·&nbsp; Resident-built, primary-source data</p>
    </td></tr>
  </table>
</body>
</html>`;
}
