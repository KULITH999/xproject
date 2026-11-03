VOID X VPN - Deploy Guide
=========================
1. apps-script/Code.gs  -> Apps Script එකේ සම්පූර්ණයෙන් paste කරන්න (Ctrl+A, Delete, Paste, Save)
2. setAdminCredentials() වෙනස් කරලා Run කරන්න, ඊට පස්සේ setupDatabase() Run කරන්න
3. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone) > /exec URL copy කරන්න
4. api.js එකේ PASTE_YOUR_EXEC_URL_HERE වෙනුවට ඒ URL දාන්න
5. මේ folder එකේ index.html, admin.html, api.js, vercel.json, logos/ ටික GitHub එකට upload කරන්න
   (apps-script folder එක GitHub එකට අවශ්‍ය නැහැ)
6. Vercel > Add New > Project > repo import > Framework: Other > Deploy
7. Admin: https://your-site.vercel.app/admin

Logos (optional): logos/ folder එකට httpinjector.png, netmod.png, npv.png දාන්න.
නැත්නම් බොත්තම් වල නම් text විදියට පෙන්නනවා.
