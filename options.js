/**
 * Cookie Preference Manager - Options Page Script
 * Enhanced with pagination, mode filtering, and Cookie JSON comparison
 */

let currentMode = 'all';
let currentPage = 1;
let itemsPerPage = 25;
let allLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadLogs();

  document.getElementById('exportJSON').addEventListener('click', exportJSON);
  document.getElementById('exportCSV').addEventListener('click', exportCSV);
  document.getElementById('clearLogs').addEventListener('click', clearLogs);
  
  document.getElementById('filterAll').addEventListener('click', () => setMode('all'));
  document.getElementById('filterNormal').addEventListener('click', () => setMode('normal'));
  document.getElementById('filterIncognito').addEventListener('click', () => setMode('incognito'));
  
  document.getElementById('firstPage').addEventListener('click', () => goToPage(1));
  document.getElementById('prevPage').addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('nextPage').addEventListener('click', () => goToPage(currentPage + 1));
  document.getElementById('lastPage').addEventListener('click', () => goToPage(getTotalPages()));
  document.getElementById('itemsPerPage').addEventListener('change', handleItemsPerPageChange);
});

async function setMode(mode) {
  currentMode = mode;
  currentPage = 1;
  
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`filter${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
  
  await loadLogs();
}

async function loadLogs() {
  const result = await chrome.storage.local.get(['logs', 'incognito_logs']);
  const normalLogs = result.logs || [];
  const incognitoLogs = result.incognito_logs || [];

  if (currentMode === 'all') {
    allLogs = [
      ...normalLogs.map(log => ({ ...log, mode: 'normal' })),
      ...incognitoLogs.map(log => ({ ...log, mode: 'incognito' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (currentMode === 'normal') {
    allLogs = normalLogs.map(log => ({ ...log, mode: 'normal' }));
  } else {
    allLogs = incognitoLogs.map(log => ({ ...log, mode: 'incognito' }));
  }

  updateStats();
  displayPage();
}

function updateStats() {
  const totalLogs = allLogs.length;
  const totalPages = getTotalPages();
  
  document.getElementById('totalLogs').textContent = `${totalLogs} total log${totalLogs !== 1 ? 's' : ''}`;
  document.getElementById('pageInfo').textContent = totalLogs > 0 
    ? `Page ${currentPage} of ${totalPages}` 
    : 'No logs';
}

function displayPage() {
  const tbody = document.getElementById('logsTableBody');
  const emptyState = document.getElementById('emptyState');
  const paginationControls = document.getElementById('paginationControls');

  if (allLogs.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    paginationControls.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';

  const totalPages = getTotalPages();
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 'all' ? allLogs.length : startIndex + itemsPerPage;
  const logsToDisplay = allLogs.slice(startIndex, endIndex);

  tbody.innerHTML = logsToDisplay.map(log => {
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleString();
    const actionClass = `action-${log.action.replace(/_/g, '')}`;
    const detailsStr = formatDetails(log.details);
    const modeIcon = log.mode === 'incognito' ? '🕶️' : '🌐';

    return `
      <tr class="log-row-${log.mode}">
        <td>${modeIcon} ${timeStr}</td>
        <td>
          <a href="${log.url}" target="_blank" class="site-link">${log.domain}</a>
        </td>
        <td>
          <span class="action-badge ${actionClass}">${log.action}</span>
        </td>
        <td>
          <span class="details-text" title="${detailsStr}">${detailsStr}</span>
        </td>
      </tr>
    `;
  }).join('');

  if (itemsPerPage !== 'all' && allLogs.length > 10) {
    paginationControls.style.display = 'flex';
    updatePaginationControls(totalPages);
  } else {
    paginationControls.style.display = 'none';
  }
}

function getTotalPages() {
  if (itemsPerPage === 'all') return 1;
  return Math.ceil(allLogs.length / itemsPerPage);
}

function goToPage(page) {
  const totalPages = getTotalPages();
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentPage = page;
  displayPage();
}

function handleItemsPerPageChange(e) {
  const value = e.target.value;
  itemsPerPage = value === 'all' ? 'all' : parseInt(value);
  currentPage = 1;
  displayPage();
}

function updatePaginationControls(totalPages) {
  const pageNumbers = document.getElementById('pageNumbers');
  const firstBtn = document.getElementById('firstPage');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const lastBtn = document.getElementById('lastPage');

  firstBtn.disabled = currentPage === 1;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
  lastBtn.disabled = currentPage === totalPages;

  const pageNumbersHTML = generatePageNumbers(currentPage, totalPages);
  pageNumbers.innerHTML = pageNumbersHTML;

  pageNumbers.querySelectorAll('.page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      goToPage(page);
    });
  });
}

function generatePageNumbers(current, total) {
  const pages = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    }
  }

  return pages.map(page => {
    if (page === '...') {
      return '<span class="ellipsis">...</span>';
    }
    const activeClass = page === current ? 'active' : '';
    return `<button class="page-number ${activeClass}" data-page="${page}">${page}</button>`;
  }).join('');
}

function formatDetails(details) {
  if (typeof details === 'string') {
    return details;
  }

  if (typeof details === 'object') {
    // Manifest detected
    if (details.cookie_count && details.source) {
      return `Source: ${details.source}, Cookies: ${details.cookie_count}, Vendors: ${details.vendor_count || 0}`;
    }

    // Banner handled
    if (details.method) {
      let text = `Method: ${details.method}, Button: "${details.buttonText || 'N/A'}"`;
      if (details.platform && details.platform !== 'unknown') {
        text += `, Platform: ${details.platform}`;
      }
      if (details.steps) {
        text += `, Steps: ${details.steps.join(' → ')}`;
      }
      return text;
    }

    // Cookies deleted
    if (details.count !== undefined) {
      let text = `Deleted ${details.count} cookie(s)`;
      
      if (details.method === 'cookie_json_manifest') {
        text += ` [Cookie JSON - ${details.accuracy} accurate]`;
      } else if (details.method === 'pattern_matching') {
        text += ` [Pattern - ${details.accuracy || 'N/A'} accurate]`;
      }
      
      if (details.unknown_count) {
        text += `, Unknown: ${details.unknown_count}`;
      }
      
      if (details.cookies && details.cookies.length > 0) {
        const cookieList = details.cookies.slice(0, 3).map(c => {
          if (c.vendor) {
            return `${c.name} (${c.category} - ${c.vendor})`;
          }
          return `${c.name} (${c.category})`;
        }).join(', ');
        text += ` - ${cookieList}${details.count > 3 ? '...' : ''}`;
      }
      
      return text;
    }

    // TCF detected
    if (details.framework) {
      return `Framework: ${details.framework}, Vendors: ${details.vendorCount || 0}`;
    }

    return JSON.stringify(details).substring(0, 150);
  }

  return String(details);
}

async function exportJSON() {
  const result = await chrome.storage.local.get(['logs', 'incognito_logs']);
  
  const exportData = {
    normal_mode: result.logs || [],
    incognito_mode: result.incognito_logs || [],
    export_date: new Date().toISOString(),
    total_logs: (result.logs?.length || 0) + (result.incognito_logs?.length || 0),
    version: '2.0.0'
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, `cookie-manager-logs-${Date.now()}.json`);
}

async function exportCSV() {
  const result = await chrome.storage.local.get(['logs', 'incognito_logs']);
  const allLogsForExport = [
    ...(result.logs || []).map(log => ({ ...log, mode: 'normal' })),
    ...(result.incognito_logs || []).map(log => ({ ...log, mode: 'incognito' }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let csv = 'Timestamp,Mode,Domain,URL,Action,Method,Details\n';

  allLogsForExport.forEach(log => {
    const method = log.details?.method || 'N/A';
    const details = formatDetails(log.details).replace(/"/g, '""');
    csv += `"${log.timestamp}","${log.mode}","${log.domain}","${log.url}","${log.action}","${method}","${details}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `cookie-manager-logs-${Date.now()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function clearLogs() {
  const confirmMsg = currentMode === 'all' 
    ? 'Clear ALL logs (normal + incognito)? This cannot be undone.' 
    : `Clear ${currentMode} mode logs only? This cannot be undone.`;
    
  if (!confirm(confirmMsg)) return;

  if (currentMode === 'all') {
    await chrome.storage.local.set({ logs: [], incognito_logs: [] });
  } else if (currentMode === 'normal') {
    await chrome.storage.local.set({ logs: [] });
  } else {
    await chrome.storage.local.set({ incognito_logs: [] });
  }

  await loadLogs();
  alert('Logs cleared successfully.');
}