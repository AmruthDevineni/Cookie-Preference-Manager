/**
 * Cookie Preference Manager - Popup Script with IMPROVED AI Review
 * Groups cookies by website with collapsible sections
 */

let currentTab = 'preferences';
let reviewQueue = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadPreferences();
  await updateBannerCount();
  await loadReviewQueue();
  await checkAIStatus();

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Preference actions
  document.getElementById('savePreferences').addEventListener('click', savePreferences);
  document.getElementById('viewLogs').addEventListener('click', viewLogs);
  document.getElementById('resetCooldowns').addEventListener('click', resetCooldowns);
  
  // AI actions
  const initAIBtn = document.getElementById('initAI');
  if (initAIBtn) {
    initAIBtn.addEventListener('click', initializeAI);
  }

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'AI_INIT_PROGRESS') {
      updateAIStatus('loading', `🔄 Loading: ${message.progress}%`);
    } else if (message.type === 'AI_READY') {
      updateAIStatus('ready', '✅ AI Ready');
      const aiInitSection = document.getElementById('aiInitSection');
      if (aiInitSection) aiInitSection.style.display = 'none';
    } else if (message.type === 'AI_ERROR') {
      updateAIStatus('error', '❌ AI Error: ' + message.error);
    } else if (message.type === 'REVIEW_QUEUE_UPDATED') {
      loadReviewQueue();
      updateBannerCount(); // Also update banner counts
    } else if (message.type === 'BANNER_HANDLED') {
      updateBannerCount(); // Update when new banner handled
    }
  });
});

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.content === tabName);
  });
  
  if (tabName === 'review') {
    loadReviewQueue();
    checkAIStatus();
  }
}

// ============================================================================
// PREFERENCES
// ============================================================================

async function loadPreferences() {
  const prefs = await chrome.storage.sync.get({
    enabled: true,
    safeMode: false,
    aiEnabled: true,
    allowAnalytics: false,
    allowAdvertising: false,
    allowPersonalization: false
  });

  document.getElementById('enabled').checked = prefs.enabled;
  document.getElementById('safeMode').checked = prefs.safeMode;
  document.getElementById('aiEnabled').checked = prefs.aiEnabled;
  document.getElementById('allowAnalytics').checked = prefs.allowAnalytics;
  document.getElementById('allowAdvertising').checked = prefs.allowAdvertising;
  document.getElementById('allowPersonalization').checked = prefs.allowPersonalization;
}

async function savePreferences() {
  const prefs = {
    enabled: document.getElementById('enabled').checked,
    safeMode: document.getElementById('safeMode').checked,
    aiEnabled: document.getElementById('aiEnabled').checked,
    allowAnalytics: document.getElementById('allowAnalytics').checked,
    allowAdvertising: document.getElementById('allowAdvertising').checked,
    allowPersonalization: document.getElementById('allowPersonalization').checked
  };

  await chrome.storage.sync.set(prefs);
  showMessage('✓ Preferences saved!', '#4CAF50');
}

async function resetCooldowns() {
  try {
    const allStorage = await chrome.storage.local.get(null);
    const cooldownKeys = Object.keys(allStorage).filter(key => key.startsWith('cooldown_'));
    
    if (cooldownKeys.length === 0) {
      showMessage('No cooldowns to clear', '#2196F3');
      return;
    }

    await chrome.storage.local.remove(cooldownKeys);
    showMessage(`✓ Cleared ${cooldownKeys.length} cooldowns!`, '#4CAF50');
    
  } catch (error) {
    console.error('[CookiePM] Error:', error);
    showMessage('Error clearing cooldowns', '#f44336');
  }
}

function showMessage(text, color) {
  const message = document.getElementById('saveMessage');
  message.textContent = text;
  message.style.background = color;
  message.style.display = 'block';
  
  setTimeout(() => {
    message.style.display = 'none';
  }, 2000);
}

async function updateBannerCount() {
  const result = await chrome.storage.local.get(['logs', 'incognito_logs']);
  const logs = result.logs || [];
  const incognitoLogs = result.incognito_logs || [];
  const allLogs = [...logs, ...incognitoLogs];

  const today = new Date().toDateString();
  
  // Count today's banners
  const todayCount = allLogs.filter(log => {
    const logDate = new Date(log.timestamp).toDateString();
    return logDate === today && log.action === 'banner_handled';
  }).length;
  
  // Count all-time banners
  const lifetimeCount = allLogs.filter(log => 
    log.action === 'banner_handled'
  ).length;

  document.getElementById('bannerCountToday').textContent = todayCount;
  document.getElementById('bannerCountLifetime').textContent = lifetimeCount;
}

function viewLogs() {
  chrome.runtime.openOptionsPage();
}

// ============================================================================
// AI STATUS CHECKING
// ============================================================================

async function checkAIStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AI_STATUS' });
    
    if (response.initialized) {
      updateAIStatus('ready', '✅ AI Ready');
      const aiInitSection = document.getElementById('aiInitSection');
      if (aiInitSection) aiInitSection.style.display = 'none';
    } else if (response.initializing) {
      updateAIStatus('loading', '🔄 AI Initializing...');
      const aiInitSection = document.getElementById('aiInitSection');
      if (aiInitSection) aiInitSection.style.display = 'none';
    } else {
      const aiInitSection = document.getElementById('aiInitSection');
      if (aiInitSection) {
        aiInitSection.style.display = 'block';
      }
      const aiStatus = document.getElementById('aiStatus');
      if (aiStatus) aiStatus.style.display = 'none';
    }
  } catch (error) {
    console.error('[AI] Status check failed:', error);
  }
}

async function initializeAI() {
  updateAIStatus('loading', '🔄 Initializing AI...');
  
  const initButton = document.getElementById('initAI');
  if (initButton) {
    initButton.disabled = true;
    initButton.textContent = '🔄 Initializing...';
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'INIT_AI' });
    
    if (response.success) {
      updateAIStatus('ready', '✅ AI Ready!');
      const aiInitSection = document.getElementById('aiInitSection');
      if (aiInitSection) aiInitSection.style.display = 'none';
      
      setTimeout(() => {
        const aiStatus = document.getElementById('aiStatus');
        if (aiStatus) aiStatus.style.display = 'none';
      }, 3000);
    } else {
      updateAIStatus('error', '❌ Initialization failed');
      if (initButton) {
        initButton.disabled = false;
        initButton.textContent = '🔄 Retry Initialization';
      }
    }
  } catch (error) {
    console.error('[AI] Init error:', error);
    updateAIStatus('error', '❌ Error: ' + error.message);
    if (initButton) {
      initButton.disabled = false;
      initButton.textContent = '🔄 Retry Initialization';
    }
  }
}

function updateAIStatus(status, text) {
  const aiStatus = document.getElementById('aiStatus');
  const aiStatusText = document.getElementById('aiStatusText');
  const aiStatusIcon = document.getElementById('aiStatusIcon');
  
  if (!aiStatus || !aiStatusText) return;
  
  aiStatus.style.display = 'flex';
  aiStatus.className = `ai-status ${status}`;
  aiStatusText.textContent = text;
  
  if (aiStatusIcon) {
    if (status === 'loading') {
      aiStatusIcon.textContent = '🔄';
    } else if (status === 'ready') {
      aiStatusIcon.textContent = '✅';
    } else if (status === 'error') {
      aiStatusIcon.textContent = '❌';
    }
  }
}

// ============================================================================
// REVIEW QUEUE - GROUPED BY WEBSITE
// ============================================================================

async function loadReviewQueue() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_REVIEW_QUEUE' });
    
    if (!response) {
      console.error('[Review] Failed to get queue');
      return;
    }

    reviewQueue = response.queue || [];
    const count = reviewQueue.length;
    
    // Update badge
    const badge = document.getElementById('reviewBadge');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    
    // Render review list grouped by website
    renderReviewListGrouped();
  } catch (error) {
    console.error('[Review] Load error:', error);
  }
}

function renderReviewListGrouped() {
  const reviewList = document.getElementById('reviewList');
  const emptyReview = document.getElementById('emptyReview');
  
  if (reviewQueue.length === 0) {
    reviewList.innerHTML = '';
    emptyReview.style.display = 'block';
    return;
  }
  
  emptyReview.style.display = 'none';
  
  // Group cookies by domain
  const groupedByDomain = {};
  reviewQueue.forEach(cookie => {
    if (!groupedByDomain[cookie.domain]) {
      groupedByDomain[cookie.domain] = [];
    }
    groupedByDomain[cookie.domain].push(cookie);
  });
  
  // Render grouped by website
  reviewList.innerHTML = Object.keys(groupedByDomain).map(domain => {
    const cookies = groupedByDomain[domain];
    const domainId = domain.replace(/\./g, '_');
    
    return `
      <div class="website-group">
        <div class="website-header" data-domain-id="${domainId}">
          <div class="website-info">
            <span class="website-icon">🌐</span>
            <span class="website-name">${domain}</span>
            <span class="cookie-count-badge">${cookies.length} cookie${cookies.length > 1 ? 's' : ''}</span>
          </div>
          <span class="expand-icon" id="expand-${domainId}">▼</span>
        </div>
        
        <div class="website-cookies" id="cookies-${domainId}" style="display: none;">
          ${cookies.map(cookie => renderCookieCard(cookie)).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners (CSP-compliant - no inline onclick)
  setTimeout(() => {
    // Website group toggles
    document.querySelectorAll('.website-header').forEach(header => {
      header.addEventListener('click', function() {
        const domainId = this.getAttribute('data-domain-id');
        toggleWebsiteGroup(domainId);
      });
    });
    
    // Cookie detail toggles  
    document.querySelectorAll('.cookie-header').forEach(header => {
      header.addEventListener('click', function() {
        const cookieId = this.getAttribute('data-cookie-id-header');
        toggleCookieDetails(cookieId);
      });
    });
    
    // Decision buttons
    document.querySelectorAll('.btn-delete, .btn-keep').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const cookieId = this.getAttribute('data-cookie-id');
        const decision = this.getAttribute('data-decision');
        decideCookie(cookieId, decision);
      });
    });
  }, 50);
}

function renderCookieCard(cookie) {
  const confidencePercent = Math.round(cookie.confidence * 100);
  const confidenceClass = cookie.confidence < 0.8 ? 'low-confidence' : '';
  const categoryClass = `category-${cookie.category}`;
  
  // Handle missing or default reasoning
  let reasoning = cookie.reasoning || '';
  let reasoningDisplay = '';
  
  if (confidencePercent === 30 || reasoning.includes('AI failed') || reasoning.includes('safe default')) {
    reasoningDisplay = `
      <div class="reasoning-text error">
        ⚠️ <strong>AI Rate Limited:</strong> The AI service hit its rate limit. This cookie was kept for safety. 
        Please wait 60 seconds and reload the page to retry classification, or manually decide below.
      </div>
    `;
  } else if (reasoning) {
    reasoningDisplay = `
      <div class="reasoning-text">
        💡 <strong>AI Analysis:</strong> ${reasoning}
      </div>
    `;
  } else {
    reasoningDisplay = `
      <div class="reasoning-text">
        💡 <strong>AI Analysis:</strong> Classification based on cookie name and domain patterns
      </div>
    `;
  }
  
  return `
    <div class="cookie-card" data-cookie-id="${cookie.id}">
      <div class="cookie-header" data-cookie-id-header="${cookie.id}">
        <div class="cookie-name-section">
          <span class="cookie-icon">🍪</span>
          <span class="cookie-name">${cookie.cookieName}</span>
          <span class="ai-badge ${confidenceClass}">AI: ${confidencePercent}%</span>
        </div>
        <span class="expand-icon" id="expand-cookie-${cookie.id}">▼</span>
      </div>
      
      <div class="cookie-details" id="details-${cookie.id}" style="display: none;">
        <div class="detail-row">
          <span class="detail-label">Domain:</span>
          <span class="detail-value">${cookie.domain}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">AI Classification:</span>
          <span class="detail-value ${categoryClass}">
            ${cookie.category.toUpperCase()}
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Confidence Level:</span>
          <div class="confidence-bar-container">
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
            </div>
            <span class="confidence-percent">${confidencePercent}%</span>
          </div>
        </div>
        
        ${reasoningDisplay}
        
        <div class="detail-row">
          <span class="detail-label">Classification Source:</span>
          <span class="detail-value">${cookie.source}</span>
        </div>
        
        ${cookie.value ? `
        <div class="detail-row">
          <span class="detail-label">Value Sample:</span>
          <span class="detail-value cookie-value">
            ${cookie.value.substring(0, 40)}${cookie.value.length > 40 ? '...' : ''}
          </span>
        </div>
        ` : ''}
        
        <div class="decision-info">
          <p><strong>What should I do?</strong></p>
          <ul>
            <li><strong>Delete:</strong> Remove this cookie now and block it in the future</li>
            <li><strong>Keep:</strong> Allow this cookie and remember this choice</li>
          </ul>
        </div>
        
        <div class="cookie-actions">
          <button class="btn-delete" data-cookie-id="${cookie.id}" data-decision="delete">
            🗑️ Delete Cookie
          </button>
          <button class="btn-keep" data-cookie-id="${cookie.id}" data-decision="keep">
            ✅ Keep Cookie
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// TOGGLE FUNCTIONS
// ============================================================================

window.toggleWebsiteGroup = function(domainId) {
  const cookiesDiv = document.getElementById(`cookies-${domainId}`);
  const expandIcon = document.getElementById(`expand-${domainId}`);
  
  if (!cookiesDiv) return;
  
  const isExpanded = cookiesDiv.style.display !== 'none';
  
  if (isExpanded) {
    cookiesDiv.style.display = 'none';
    expandIcon.textContent = '▼';
  } else {
    cookiesDiv.style.display = 'block';
    expandIcon.textContent = '▲';
  }
};

window.toggleCookieDetails = function(cookieId) {
  const details = document.getElementById(`details-${cookieId}`);
  const expandIcon = document.getElementById(`expand-cookie-${cookieId}`);
  
  if (!details) return;
  
  const isExpanded = details.style.display !== 'none';
  
  if (isExpanded) {
    details.style.display = 'none';
    if (expandIcon) expandIcon.textContent = '▼';
  } else {
    details.style.display = 'block';
    if (expandIcon) expandIcon.textContent = '▲';
  }
};

// ============================================================================
// COOKIE DECISION HANDLING
// ============================================================================

window.decideCookie = async function(cookieId, decision) {
  try {
    const card = document.querySelector(`[data-cookie-id="${cookieId}"]`);
    if (card) {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }

    const response = await chrome.runtime.sendMessage({
      type: 'DECIDE_COOKIE',
      cookieId: cookieId,
      decision: decision
    });

    if (response.success) {
      showMessage(
        decision === 'delete' ? '🗑️ Cookie deleted' : '✅ Cookie kept',
        decision === 'delete' ? '#ef5350' : '#66bb6a'
      );
      
      if (card) {
        card.style.transition = 'all 0.3s';
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        
        setTimeout(() => {
          loadReviewQueue();
        }, 300);
      } else {
        loadReviewQueue();
      }
    } else {
      showMessage('❌ Error processing decision', '#f44336');
      if (card) {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    }

  } catch (error) {
    console.error('[Review] Decision error:', error);
    showMessage('❌ Error: ' + error.message, '#f44336');
    const card = document.querySelector(`[data-cookie-id="${cookieId}"]`);
    if (card) {
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
    }
  }
};
window.toggleWebsiteGroup = function(domainId) {
  console.log('Toggling website:', domainId);
  
  const cookiesDiv = document.getElementById('cookies-' + domainId);
  const expandIcon = document.getElementById('expand-' + domainId);
  
  if (!cookiesDiv) {
    console.error('Could not find div:', 'cookies-' + domainId);
    return;
  }
  
  if (cookiesDiv.style.display === 'block') {
    cookiesDiv.style.display = 'none';
    if (expandIcon) expandIcon.textContent = '▼';
  } else {
    cookiesDiv.style.display = 'block';
    if (expandIcon) expandIcon.textContent = '▲';
  }
};

window.toggleCookieDetails = function(cookieId) {
  console.log('Toggling cookie:', cookieId);
  
  const details = document.getElementById('details-' + cookieId);
  const card = document.querySelector('[data-cookie-id="' + cookieId + '"]');
  const header = card ? card.querySelector('.cookie-header') : null;
  const expandIcon = header ? header.querySelector('.expand-icon') : null;
  
  if (!details) {
    console.error('Could not find details:', 'details-' + cookieId);
    return;
  }
  
  if (details.style.display === 'block') {
    details.style.display = 'none';
    if (expandIcon) expandIcon.textContent = '▼';
    if (card) card.classList.remove('expanded');
  } else {
    details.style.display = 'block';
    if (expandIcon) expandIcon.textContent = '▲';
    if (card) card.classList.add('expanded');
  }
};