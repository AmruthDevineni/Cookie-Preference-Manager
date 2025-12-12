
let cookieDatabase = null;
let aiInitialized = false;
let blockedCookies = new Set(); 
let recentlyAttempted = new Map();
const ATTEMPT_COOLDOWN = 30000; 
const MAX_DELETION_ATTEMPTS = 3; 
const BLOCKLIST_CLEANUP_INTERVAL = 300000; 

// Groq API Configuration
const GROQ_API_KEY = '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';


setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  // Clean old attempts
  for (const [key, data] of recentlyAttempted.entries()) {
    if (now - data.timestamp > BLOCKLIST_CLEANUP_INTERVAL) {
      recentlyAttempted.delete(key);
      blockedCookies.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Cleanup] Removed ${cleaned} old blocklist entries`);
  }
}, BLOCKLIST_CLEANUP_INTERVAL);



async function deleteCookieViaAPI(cookieName, url, domain) {
  const blockKey = `${domain}:${cookieName}`;
  
  // Check if we've attempted this recently
  const attemptData = recentlyAttempted.get(blockKey);
  const now = Date.now();
  
  if (attemptData) {
    // Check if we're in cooldown period
    if (now - attemptData.timestamp < ATTEMPT_COOLDOWN) {
      return false;
    }
    
    // Check if we've exceeded max attempts
    if (attemptData.attempts >= MAX_DELETION_ATTEMPTS) {
      return false;
    }
  }
  
  console.log(`[API] 🗑️  Attempting to delete: ${cookieName} from ${domain}`);
  
  try {
    // CRITICAL FIX: Search ALL cookie stores (normal + incognito)
    const allCookiesWithName = await chrome.cookies.getAll({ name: cookieName });
    
    console.log(`[API] 🔍 Found ${allCookiesWithName.length} total cookie(s) named "${cookieName}" across all stores`);
    
    // Filter to only cookies that match our domain (including subdomains)
    const matchingCookies = allCookiesWithName.filter(cookie => {
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
      const matches = domain.endsWith(cookieDomain) || cookieDomain.endsWith(domain) || domain === cookieDomain;
      
      if (matches) {
        console.log(`[API] 📍 Match found: ${cookie.name} on ${cookie.domain} (store: ${cookie.storeId}, secure: ${cookie.secure})`);
      }
      
      return matches;
    });
    
    if (matchingCookies.length === 0) {
      console.log(`[API] ⚠️  No instances of "${cookieName}" found for domain ${domain}`);
      
      // Track this attempt
      recentlyAttempted.set(blockKey, {
        timestamp: now,
        attempts: (attemptData?.attempts || 0) + 1
      });
      
      return false;
    }
    
    console.log(`[API] 🎯 Found ${matchingCookies.length} matching cookie(s) to delete`);
    
    let successCount = 0;
    let failureReasons = [];
    
    for (const cookie of matchingCookies) {
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
      const deleteUrl = `${protocol}${cookieDomain}${cookie.path}`;
      
      console.log(`[API] 🗑️  Deleting: ${cookie.name} from ${deleteUrl} (store: ${cookie.storeId})`);
      
      try {
        const removed = await chrome.cookies.remove({
          url: deleteUrl,
          name: cookie.name,
          storeId: cookie.storeId
        });
        
        if (removed) {
          successCount++;
          console.log(`[API] ✅ Successfully deleted: ${cookie.name} from ${cookie.domain}${cookie.path} (store: ${cookie.storeId})`);
        } else {
          const reason = `Cookie returned null (may be HttpOnly or already deleted)`;
          failureReasons.push(reason);
          console.log(`[API] ⚠️  Failed to delete: ${cookie.name} - ${reason}`);
        }
      } catch (error) {
        failureReasons.push(error.message);
        console.error(`[API] ❌ Exception deleting ${cookie.name}:`, error.message);
      }
    }
    
    if (successCount > 0) {
      // Add to blocklist AFTER successful deletion
      blockedCookies.add(blockKey);
      console.log(`[API] 🚫 Added to blocklist: ${blockKey} (deleted ${successCount}/${matchingCookies.length})`);
      
      // Update attempt tracking
      recentlyAttempted.set(blockKey, {
        timestamp: now,
        attempts: (attemptData?.attempts || 0) + 1
      });
      
      return true;
    } else {
      console.log(`[API] ❌ Failed to delete ANY instances of ${cookieName}`);
      if (failureReasons.length > 0) {
        console.log(`[API] Failure reasons: ${failureReasons.join(', ')}`);
      }
      
      // Track the failure
      recentlyAttempted.set(blockKey, {
        timestamp: now,
        attempts: (attemptData?.attempts || 0) + 1
      });
      
      return false;
    }
    
  } catch (error) {
    console.error(`[API] ❌ Error deleting ${cookieName}:`, error);
    return false;
  }
}

// ============================================================================
// REAL-TIME COOKIE BLOCKING - Intercepts cookie creation
// ============================================================================

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!changeInfo.removed && changeInfo.cookie) {
    const cookie = changeInfo.cookie;
    const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
    const blockKey = `${domain}:${cookie.name}`;
    
    if (blockedCookies.has(blockKey)) {
      console.log(`[Blocker] 🚫 Intercepting blocked cookie: ${cookie.name} from ${domain}`);
      
      // Immediately delete it
      const protocol = cookie.secure ? 'https://' : 'http://';
      const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
      const deleteUrl = `${protocol}${cookieDomain}${cookie.path}`;
      
      chrome.cookies.remove({
        url: deleteUrl,
        name: cookie.name,
        storeId: cookie.storeId
      }).then(removed => {
        if (removed) {
          console.log(`[Blocker] ✅ Blocked recreation of: ${cookie.name}`);
        }
      }).catch(error => {
        console.error(`[Blocker] Error blocking ${cookie.name}:`, error);
      });
    }
  }
});

// ============================================================================
// LOAD 93-COOKIE DATABASE
// ============================================================================

async function loadCookieDatabase() {
  try {
    const response = await fetch(chrome.runtime.getURL('cookieData.json'));
    cookieDatabase = await response.json();
    
    const cookieCount = Object.keys(cookieDatabase.cookies || {}).length;
    const sites = cookieDatabase.sites_covered || [];
    const stats = cookieDatabase.statistics || {};
    
    console.log('='.repeat(70));
    console.log('🍪 Cookie Preference Manager v2.3-FINAL-FIX');
    console.log('='.repeat(70));
    console.log(`✓ Version: ${cookieDatabase.version}`);
    console.log(`✓ Total Cookies in Database: ${cookieCount}`);
    console.log(`✓ Essential: ${stats.essential || 0}`);
    console.log(`✓ Analytics: ${stats.analytics || 0}`);
    console.log(`✓ Advertising: ${stats.advertising || 0}`);
    console.log(`✓ Functional: ${stats.functional || 0}`);
    console.log(`✓ Social: ${stats.social || 0}`);
    console.log(`✓ Sites Covered: ${sites.length}`);
    console.log('='.repeat(70));
    
    return cookieDatabase;
  } catch (error) {
    console.error('[CookiePM] Failed to load cookie database:', error);
    return null;
  }
}

// ============================================================================
// AI INITIALIZATION
// ============================================================================

async function initializeAI() {
  if (aiInitialized) {
    console.log('[AI] Already initialized');
    return true;
  }

  console.log('[AI] Initializing Groq API with Llama 3.2...');
  
  try {
    // Test API with a simple classification
    const testResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{
          role: 'user',
          content: 'Classify this cookie: "_ga". Respond with JSON only: {"category":"analytics","confidence":0.95,"reasoning":"Google Analytics tracking"}'
        }],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (!testResponse.ok) {
      throw new Error(`API test failed: ${testResponse.status}`);
    }

    aiInitialized = true;
    console.log('[AI] ✓ Groq API initialized successfully');
    console.log('[AI] Model: Llama 3.1 8B Instant (FREE)');
    console.log('[AI] Speed: ~500 tokens/second');
    console.log('[AI] Cost: $0 (100% FREE)');
    
    return true;
  } catch (error) {
    console.error('[AI] Initialization failed:', error);
    aiInitialized = false;
    return false;
  }
}

// ============================================================================
// AI CLASSIFICATION
// ============================================================================

async function classifyWithAI(cookieName, cookieDomain, cookieValue, retryCount = 0) {
  const MAX_RETRIES = 2;
  
  if (!aiInitialized) {
    const initialized = await initializeAI();
    if (!initialized) {
      return {
        category: 'functional',
        confidence: 0.3,
        reasoning: 'AI not available'
      };
    }
  }

  const prompt = `You are a cookie classification expert. Analyze this cookie and provide ONLY a JSON response.

Cookie name: "${cookieName}"
Domain: "${cookieDomain}"
Value: "${cookieValue?.substring(0, 100) || 'N/A'}"

Classify into ONE of these categories:
- essential        (required for login, session, security, site operation)
- analytics        (site measurement, performance, behavior tracking)
- personalisation  (preferences, customisation, A/B testing, UX tailoring)
- advertisement    (ads, retargeting, cross-site tracking, campaign IDs)

Respond ONLY with valid JSON in this exact format:
{"category":"<category>","confidence":<0.0-1.0>,"reasoning":"<brief explanation>"}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] API error:', response.status, errorText);
      
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const waitTime = 3000;
        console.log(`[AI] Rate limited - waiting ${waitTime/1000}s before retry ${retryCount + 1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return classifyWithAI(cookieName, cookieDomain, cookieValue, retryCount + 1);
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponse = data.choices[0].message.content.trim();
    
    aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '');

    const result = JSON.parse(aiResponse);

    const validCategories = ['essential', 'analytics', 'advertising', 'personalization'];
    if (!validCategories.includes(result.category)) {
      console.warn(`[AI] Invalid category: ${result.category}, defaulting to personalization`);
      result.category = 'personalization';
    }

    result.confidence = parseFloat(result.confidence);
    if (isNaN(result.confidence) || result.confidence < 0 || result.confidence > 1) {
      console.warn(`[AI] Invalid confidence: ${result.confidence}, defaulting to 0.5`);
      result.confidence = 0.5;
    }

    console.log(`[AI] ✓ ${cookieName} → ${result.category} (${Math.round(result.confidence * 100)}%): ${result.reasoning}`);

    return result;

  } catch (error) {
    console.error(`[AI] ❌ Classification error for "${cookieName}":`, error.message);
    return {
      category: 'personalization',
      confidence: 0.3,
      reasoning: `AI failed: ${error.message}`
    };
  }
}

// ============================================================================
// REVIEW QUEUE MANAGEMENT
// ============================================================================

async function addToReviewQueue(cookie, classification) {
  const reviewItem = {
    id: `${cookie.domain}_${cookie.name}_${Date.now()}`,
    cookieName: cookie.name,
    domain: cookie.domain,
    value: cookie.value?.substring(0, 100),
    category: classification.category,
    confidence: classification.confidence,
    reasoning: classification.reasoning || 'AI analysis based on cookie name and domain',
    source: classification.source,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  const result = await chrome.storage.local.get(['uncertainCookies']);
  const queue = result.uncertainCookies || [];
  
  const exists = queue.find(item => 
    item.cookieName === cookie.name && 
    item.domain === cookie.domain &&
    item.status === 'pending'
  );
  
  if (!exists) {
    queue.push(reviewItem);
    await chrome.storage.local.set({ uncertainCookies: queue });
    
    const pendingCount = queue.filter(item => item.status === 'pending').length;
    updateReviewBadge(pendingCount);
    
    console.log(`[Review] Queued: ${cookie.name} (${Math.round(classification.confidence * 100)}% confidence)`);
  }
}

function updateReviewBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
  } else {
    updateBannerBadge();
  }
}

async function addCookiesToReviewQueue(cookies) {
  for (const cookieData of cookies) {
    await addToReviewQueue(cookieData.cookie, cookieData.classification);
  }
}

async function handleCookieDecision(cookieId, decision) {
  const result = await chrome.storage.local.get(['uncertainCookies']);
  const queue = result.uncertainCookies || [];
  
  const item = queue.find(c => c.id === cookieId);
  if (!item) {
    console.log(`[Review] Cookie ${cookieId} not found in queue`);
    return;
  }
  
  item.status = decision;
  item.decidedAt = new Date().toISOString();
  
  if (decision === 'delete') {
    // Delete the cookie from the browser
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && (tab.url.includes(item.domain) || item.domain.includes(new URL(tab.url).hostname))) {
        await deleteCookieViaAPI(item.cookieName, tab.url, item.domain);
      }
    }
    
    console.log(`[Review] User confirmed deletion of: ${item.cookieName}`);
  } else {
    console.log(`[Review] User chose to keep: ${item.cookieName}`);
  }
  
  await chrome.storage.local.set({ uncertainCookies: queue });
  
  const pending = queue.filter(c => c.status === 'pending');
  updateReviewBadge(pending.length);
}

// ============================================================================
// BANNER COUNTER BADGE
// ============================================================================

let todayBannerCount = 0;
let lifetimeBannerCount = 0;
let lastResetDate = new Date().toDateString();

async function loadBannerCounts() {
  const result = await chrome.storage.local.get(['todayBannerCount', 'lifetimeBannerCount', 'lastResetDate']);
  
  const today = new Date().toDateString();
  
  if (result.lastResetDate !== today) {
    todayBannerCount = 0;
    lastResetDate = today;
    await chrome.storage.local.set({ todayBannerCount: 0, lastResetDate: today });
  } else {
    todayBannerCount = result.todayBannerCount || 0;
  }
  
  lifetimeBannerCount = result.lifetimeBannerCount || 0;
  
  updateBannerBadge();
}

function updateBannerBadge() {
  if (todayBannerCount > 0) {
    chrome.action.setBadgeText({ text: todayBannerCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function incrementBannerCount() {
  todayBannerCount++;
  lifetimeBannerCount++;
  
  await chrome.storage.local.set({
    todayBannerCount,
    lifetimeBannerCount
  });
  
  updateBannerBadge();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
  await loadCookieDatabase();
  await loadBannerCounts();
  
  await chrome.storage.local.set({
    preferences: {
      enabled: true,
      safeMode: false,
      allowAnalytics: false,
      allowAdvertising: false,
      allowPersonalization: false,
      aiEnabled: true
    }
  });
  
  console.log('[CookiePM] Extension installed v2.3-FINAL-FIX with proper deletion');
});

chrome.runtime.onStartup.addListener(async () => {
  await loadCookieDatabase();
  await loadBannerCounts();
  
  aiInitialized = true;
  
  const result = await chrome.storage.local.get(['uncertainCookies']);
  const queue = result.uncertainCookies || [];
  const pending = queue.filter(item => item.status === 'pending');
  if (pending.length > 0) {
    updateReviewBadge(pending.length);
  }
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_ACTION') {
    const isIncognito = sender.tab?.incognito || false;
    handleLogAction(message.data, isIncognito);
    sendResponse({ success: true });
    
  } else if (message.type === 'INIT_AI') {
    initializeAI()
      .then(success => sendResponse({ success }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
    
  } else if (message.type === 'CLASSIFY_WITH_AI') {
    classifyWithAI(message.cookieName, message.domain, message.value)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
    
  } else if (message.type === 'ADD_TO_REVIEW_QUEUE') {
    addCookiesToReviewQueue(message.cookies)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
    
  } else if (message.type === 'GET_REVIEW_QUEUE') {
    chrome.storage.local.get(['uncertainCookies'], (result) => {
      const queue = result.uncertainCookies || [];
      const pending = queue.filter(item => item.status === 'pending');
      sendResponse({ queue: pending, count: pending.length });
    });
    return true;
    
  } else if (message.type === 'DELETE_COOKIE') {
    console.log(`[API] Received DELETE_COOKIE request for: ${message.cookieName}`);
    
    deleteCookieViaAPI(message.cookieName, message.url, message.domain)
      .then(success => {
        console.log(`[API] Delete ${success ? 'succeeded' : 'failed'} for: ${message.cookieName}`);
        sendResponse({ success });
      })
      .catch(error => {
        console.error(`[API] Delete error for ${message.cookieName}:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
    
  } else if (message.type === 'DECIDE_COOKIE') {
    handleCookieDecision(message.cookieId, message.decision)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
    
  } else if (message.type === 'GET_AI_STATUS') {
    sendResponse({ 
      initialized: aiInitialized,
      initializing: false
    });
    return true;
    
  } else if (message.type === 'INCREMENT_BANNER_COUNT') {
    incrementBannerCount()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
    
  } else if (message.type === 'GET_BANNER_COUNTS') {
    sendResponse({ 
      today: todayBannerCount,
      lifetime: lifetimeBannerCount 
    });
    return true;
  }
  
  return true;
});

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

async function handleLogAction(logEntry, isIncognito) {
  try {
    const storageKey = isIncognito ? 'incognito_logs' : 'logs';
    const result = await chrome.storage.local.get([storageKey]);
    const logs = result[storageKey] || [];

    logs.unshift(logEntry);

    if (logs.length > 1000) {
      logs.splice(1000);
    }

    await chrome.storage.local.set({ [storageKey]: logs });

    console.log(`[CookiePM] Logged (${isIncognito ? 'incognito' : 'normal'}): ${logEntry.action}`);
  } catch (error) {
    console.error('[CookiePM] Error logging action:', error);
  }
}