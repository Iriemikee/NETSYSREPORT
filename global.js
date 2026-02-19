// =============================================
// SYSADMIN DASHBOARD — GLOBAL JS
// =============================================

// ---- CLOCK ----
function updateClock() {
  const el = document.getElementById('nav-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  }).toUpperCase();
}
updateClock();
setInterval(updateClock, 30000);

// ---- TOAST ----
function showToast(msg, isError = false) {
  let t = document.getElementById('global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'global-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = (isError ? '⚠ ' : '✓ ') + msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- LOCAL STORAGE HELPERS ----
const STORAGE_KEY = 'sysadmin_reports';

function getLocalReports() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveLocalReport(data) {
  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.date === data.date);
  if (idx >= 0) reports[idx] = data;
  else reports.unshift(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 60)));
  return reports;
}

function deleteLocalReport(date) {
  const reports = getLocalReports().filter(r => r.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// ---- GOOGLE SHEETS INTEGRATION ----
// Uses a Google Apps Script Web App as a proxy to read/write to Google Sheets

function getSheetsUrl() {
  return localStorage.getItem('sheets_url') || '';
}

async function syncToSheets(reportData) {
  const url = getSheetsUrl();
  if (!url) return { ok: false, reason: 'not_configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', data: reportData })
    });
    return { ok: true };
  } catch (e) {
    console.warn('Sheets sync failed:', e);
    return { ok: false, reason: e.message };
  }
}

async function fetchFromSheets() {
  const url = getSheetsUrl();
  if (!url) return null;
  try {
    const res = await fetch(url + '?action=getAll');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    console.warn('Sheets fetch failed:', e);
    return null;
  }
}

async function deleteFromSheets(date) {
  const url = getSheetsUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', date })
    });
  } catch (e) { console.warn('Sheets delete failed:', e); }
}

// ---- SAVE REPORT (local + sheets) ----
async function saveReport(data, onSaved) {
  // Always save locally first
  saveLocalReport(data);
  if (typeof onSaved === 'function') onSaved('local');

  // Then sync to Sheets if configured
  const result = await syncToSheets(data);
  if (result.ok) {
    showToast('Report saved & synced to Google Sheets ✓');
    if (typeof onSaved === 'function') onSaved('synced');
  } else if (result.reason === 'not_configured') {
    showToast('Report saved locally (Sheets not configured)');
  } else {
    showToast('Saved locally — Sheets sync failed', true);
  }
}

// ---- LOAD ALL REPORTS (sheets first, fall back to local) ----
async function loadAllReports() {
  const sheetsData = await fetchFromSheets();
  if (sheetsData && sheetsData.length > 0) {
    // Merge with local (sheets is source of truth)
    sheetsData.forEach(r => saveLocalReport(r));
    return sheetsData;
  }
  return getLocalReports();
}

// ---- DATE HELPERS ----
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---- ISSUE DETECTION ----
function checkIssues(r) {
  const flags = [];
  r.servers?.forEach(s => { if (['Warning','Critical','Offline'].includes(s[1])) flags.push(s); });
  r.backups?.forEach(b => { if (['Failed'].includes(b[1])) flags.push(b); });
  r.network?.forEach(n => { if (['Warning','Critical','Offline'].includes(n[2])) flags.push(n); });
  return flags.length > 0;
}

// ---- DOWNLOAD HELPER ----
function downloadDataURI(filename, mimeType, content) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 500);
  } catch {
    const b64 = btoa(unescape(encodeURIComponent(content)));
    const a = document.createElement('a');
    a.href = `data:${mimeType};base64,${b64}`; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  }
}

// ---- EXPORT PRINT (opens new tab) ----
function exportReportAsPDF(data) {
  function tableHTML(headers, rows) {
    const ths = headers.map(h => `<th>${h}</th>`).join('');
    const trs = (rows||[]).map((r,i) => `<tr class="${i%2===0?'even':''}">
      ${r.map(c => `<td>${getStatusBadge(c)}</td>`).join('')}
    </tr>`).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  function getStatusBadge(val) {
    if (!val) return '—';
    const v = val.toLowerCase();
    if (['normal','completed','verified','confirmed'].includes(v))
      return `<span class="b-ok">${val}</span>`;
    if (['warning','partial'].includes(v))
      return `<span class="b-warn">${val}</span>`;
    if (['critical','offline','failed'].includes(v))
      return `<span class="b-crit">${val}</span>`;
    return val;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>IT Report – ${data.date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px;max-width:960px;margin:auto}
  h1{font-size:20px;color:#003366;margin-bottom:4px}
  .meta{color:#555;margin-bottom:24px;font-size:12px}
  h2{font-size:13px;color:#003366;border-bottom:2px solid #003366;padding-bottom:4px;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px}
  th{background:#003366;color:#fff;padding:7px 10px;text-align:left}
  td{padding:6px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr.even td{background:#f8fafc}
  .b-ok{background:#dcfce7;color:#166534;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:bold}
  .b-warn{background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:bold}
  .b-crit{background:#fee2e2;color:#991b1b;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:bold}
  .notes{background:#f8fafc;border-left:3px solid #003366;padding:10px 14px;margin-bottom:12px;white-space:pre-wrap;line-height:1.6}
  .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#aaa;text-align:center}
  @media print{body{padding:16px}}
</style></head><body>
<h1>Daily IT System Administrator Report</h1>
<div class="meta">
  <strong>Date:</strong> ${formatDate(data.date)} &nbsp;|&nbsp;
  <strong>Prepared by:</strong> ${data.preparedBy || 'N/A'} &nbsp;|&nbsp;
  <strong>Generated:</strong> ${new Date().toLocaleString()}
</div>
<h2>1A. Server Status</h2>${tableHTML(['Location','Uptime Status','Notes / Actions'], data.servers)}
<h2>1B. Backup Tasks</h2>${tableHTML(['Location / Task','Status','Notes'], data.backups)}
<h2>1C. Security Alerts</h2>${tableHTML(['Location','Notes / Alerts'], data.security)}
<h2>2. Network &amp; Infrastructure</h2>${tableHTML(['Task','Location','Status','Notes'], data.network)}
<h2>3. Surveillance</h2>${tableHTML(['Location','Notes / Alerts'], data.surveillance)}
<h2>Summary &amp; Next Actions</h2>
<div class="notes"><strong>Summary:</strong>\n${data.summaryNotes||'—'}</div>
<div class="notes"><strong>Next Actions:</strong>\n${data.nextActions||'—'}</div>
<div class="footer">SysAdmin Dashboard · IT Report · ${new Date().toLocaleString()}</div>
<script>window.onload=()=>window.print()<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  else { downloadDataURI(`IT_Report_${data.date}.html`, 'text/html', html); showToast('HTML downloaded (popup blocked)'); }
}

// ---- TABLE COLLECTION HELPERS ----
function collectTable(tableId) {
  const rows = [];
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr => {
    const cells = [];
    tr.querySelectorAll('td').forEach(td => {
      const inp = td.querySelector('input,select,textarea');
      cells.push(inp ? inp.value : td.textContent.trim());
    });
    rows.push(cells);
  });
  return rows;
}

function loadTable(id, rows, cols) {
  if (!rows?.length) return;
  const tbody = document.querySelector(`#${id} tbody`);
  if (!tbody) return;
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    cols.forEach((col, i) => {
      const td = document.createElement('td');
      if (i === 0) {
        td.className = 'row-label';
        td.textContent = row[i] || '';
      } else if (col.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'status-select';
        (col.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          sel.appendChild(o);
        });
        sel.value = row[i] || col.options[0];
        td.appendChild(sel);
      } else {
        const inp = document.createElement('input');
        inp.className = 'cell-input';
        inp.placeholder = col.placeholder || '';
        inp.value = row[i] || '';
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}
