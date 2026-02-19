# SysAdmin Dashboard — Deployment Guide

## What's In This Package

```
sysadmin-dashboard/
├── index.html          ← Home page
├── daily.html          ← Daily report form
├── weekly.html         ← Weekly master report
├── history.html        ← Full report archive
├── settings.html       ← Google Sheets setup
├── css/
│   └── global.css      ← All styles
├── js/
│   └── global.js       ← Shared logic + Google Sheets sync
└── README.md           ← This file
```

---

## Option 1: Netlify (Free, Recommended — 2 Minutes)

1. Go to https://app.netlify.com/drop
2. Drag the entire `sysadmin-dashboard` folder onto the page
3. Done — you get a live URL like `https://random-name.netlify.app`
4. Optional: set a custom domain in Netlify settings

---

## Option 2: Any Web Host (cPanel, etc.)

1. Upload all files to your web host via FTP or File Manager
2. Keep the folder structure exactly as-is
3. Access via `https://yoursite.com/sysadmin-dashboard/`

---

## Option 3: Run Locally (No Internet)

Just double-click `index.html` to open in your browser.
All features work offline except Google Sheets sync.

---

## Setting Up Google Sheets Sync

After deploying, go to the **Settings** page in the dashboard.
Follow the 3-step guide there to connect your Google Sheet.

This gives you:
- Permanent report history (survives browser clears)
- Access from any device (phone, tablet, other computers)
- Your data in Google Sheets for extra analysis

---

## Notes

- Reports are always saved locally in the browser as a backup
- The Google Sheets sync is optional but recommended
- All exports (PDF, CSV) work without any server or internet connection
