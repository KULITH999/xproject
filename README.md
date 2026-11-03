# VOID X VPN

- Frontend: Vercel (`index.html`, `admin.html`, `api.js`, `vercel.json`)
- Backend: Google Apps Script (`apps-script/Code.gs`) + Google Sheets

## Project structure
```
void-x-vpn/
├── index.html          # Public site  → https://<project>.vercel.app/
├── admin.html          # Admin panel  → https://<project>.vercel.app/admin
├── api.js              # Vercel ↔ Apps Script bridge (API_URL මෙතන)
├── vercel.json         # Vercel config (clean URLs)
├── .gitignore
├── README.md
└── apps-script/
    └── Code.gs         # Apps Script editor එකට paste කරන්න (Vercel එකේ run වෙන්නේ නැහැ)
```

## 1. Apps Script setup
1. script.google.com එකේ `Code.gs` paste කරලා Save කරන්න (Apps Script එකේ තියෙන්න ඕන මේ file එක විතරයි).
2. Project Settings → Script Properties එකට දාන්න:
   - `SPREADSHEET_ID` = Google Sheet ID එක
   - `ADMIN_USERNAME` = admin username
   - `ADMIN_PASSWORD` = admin password
3. `checkSetup` Run කරන්න → තුනම `true` එන්න ඕන.
4. පළමු වතාවට නම් `setupDatabase` Run කරන්න.
5. Deploy → Web app → Execute as: **Me**, Who has access: **Anyone**.
   Code වෙනස් කළාම: Manage deployments → Edit → **New version** → Deploy.

## 2. Database migration (අලුත් Google Sheet එකකට)
1. `migrateToNewDatabase` ONE TIME Run කරන්න (data ඔක්කොම copy වෙනවා, පරණ sheet එක backup ලෙස තියෙනවා).
2. Deploy → Manage deployments → Edit → New version → Deploy.
3. අවුලක් වුණොත් `rollbackDatabase` Run කරන්න.

## 3. Vercel deploy
1. මේ folder එකේ files ඔක්කොම GitHub repo එකකට push / upload කරන්න.
2. vercel.com → Add New → Project → repo එක Import.
3. Framework Preset: **Other**, Build Command: හිස්ව තියන්න → Deploy.

## API test
- `<exec URL>?action=ping` → `{"status":"success","data":{"ok":true,...}}`
- `<exec URL>?action=publicData` → packages list
