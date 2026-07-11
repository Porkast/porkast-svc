export const ADMIN_NEW_USER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New User Registered - Porkast Admin</title>
  <style>
    body { margin: 0; padding: 0; background: #f4efe6; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif; }
    .shell { width: 100%; padding: 32px 16px; box-sizing: border-box; }
    .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 28px; padding: 32px; box-shadow: 0 20px 60px rgba(102, 71, 38, 0.14); border: 1px solid rgba(192, 157, 119, 0.25); }
    h1 { font-size: 28px; color: #111827; margin: 0 0 20px; font-weight: 700; }
    .field { margin: 12px 0; font-size: 15px; line-height: 1.5; }
    .label { font-weight: 600; color: #4b5563; display: inline-block; width: 130px; }
    .val { color: #111827; font-family: monospace; background: #f9f6f0; padding: 2px 8px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-block; background: #eef2ff; color: #4338ca; font-family: monospace; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; }
    .btn { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 600; }
    .footnote { margin-top: 24px; font-size: 13px; color: #6b7280; border-top: 1px solid rgba(192, 157, 119, 0.2); padding-top: 20px; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <h1>New User Registered</h1>
      <div class="field"><span class="label">User ID:</span> <span class="val">{{ userId }}</span></div>
      <div class="field"><span class="label">Nickname:</span> <span class="val">{{ nickname }}</span></div>
      <div class="field"><span class="label">Email:</span> <span class="val">{{ email }}</span></div>
      <div class="field"><span class="label">Telegram ID:</span> <span class="val">{{ telegramId }}</span></div>
      <div class="field"><span class="label">Registered At:</span> <span class="val">{{ regDate }}</span></div>
      <div class="field"><span class="label">Source:</span> <span class="badge">{{ source }}</span></div>
      {{ adminUserLink }}
    </div>
  </div>
</body>
</html>`
