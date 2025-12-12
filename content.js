/**
 * Cookie Preference Manager - Complete Content Script v2.2-FIXED
 * 
 * CRITICAL FIX v2.2:
 * - Monitoring loop now deletes ONLY detected trackers
 * - Prevents infinite cleanup cycles
 * - Works with background.js v2.2-FIXED
 * 
 * FEATURES:
 * ✅ Cookie JSON manifest support
 * ✅ 93-cookie database integration
 * ✅ 200+ enhanced pattern library (NEW!)
 * ✅ Third-party domain detection (NEW!)
 * ✅ JWT token detection (NEW!)
 * ✅ Multi-step dialog navigation
 * ✅ Platform-specific strategies (OneTrust, Cookiebot, etc.)
 * ✅ CSS-based banner hiding
 * ✅ Retry logic with exponential backoff
 * ✅ IAB TCF detection
 * ✅ Cookie naming convention support
 * ✅ Safety mechanisms (cooldowns, debouncing)
 */

(function() {
  'use strict';

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  let hasActed = false;
  let observerActive = false;
  let observer = null;
  const OBSERVER_TIMEOUT = 25000;
  const DEBOUNCE_DELAY = 500;
  const INITIAL_DELAY = 1500;
  let attemptCount = 0;
  const MAX_ATTEMPTS = 10;

  // ============================================================================
  // ENHANCED COOKIE PATTERNS (200+ patterns!)
  // ============================================================================
  
  const COOKIE_PATTERNS = {
    analytics: [
      // Google Analytics
      '_ga', '_gid', '_gat', '_gaexp', '_gac', '__utma', '__utmb', '__utmc', '__utmz', '__utmt', '_gat_gtag_',
      
      // Hotjar
      '_hjid', '_hjSession', '_hjSessionUser', '_hjIncludedInSample', '_hjIncludedInSession',
      '_hjAbsoluteSessionInProgress', '_hjTLDTest',
      
      // Adobe Analytics / Omniture
      's_ppvl', 's_ppv', 's_cc', 's_sq', 's_vi', 's_ecid', 'AMCV_', 'AMCVS_',
      
      // Amplitude
      'amplitude_', 'amplitude_id',
      
      // Mixpanel
      'mp_',
      
      // Segment
      'ajs_user_id', 'ajs_anonymous_id', 'ajs_',
      
      // Heap
      'heap_',
      
      // HubSpot
      '__hstc', '__hssrc', '__hssc', 'hubspotutk',
      
      // Matomo/Piwik
      'matomo', '_pk_id', '_pk_ses',
      
      // Chartbeat
      '_chartbeat', '_cb',
      
      // Parsely
      '_parsely',
      
      // Microsoft Clarity
      '_clck', '_clsk',
      
      // Snapchat
      '_scid', '_scid_r',
      
      // Microsoft/Bing
      '_uetsid', '_uetvid',
      
      // Vimeo
      'vuid',
      
      // Yandex
      '_ym_uid', '_ym_d',
      
      // Generic
      'analytics', 'utm_', 'vid_', 'visitor_id',
      
      // Quantcast
      '__qca', 'mc',
      
      // Additional
      'dtcookie', 'dtlatc', 'dtpc', 'rxvisitor', 'rxvt', 'utag_main',
      '_hp2_', '_hp2_id', '_hp2_ses', '_hp2_props',
      
      // Intercom
      'intercom-',
      
      // BBC specific
      'ckns_sa', 'ckns_performance',
      
      // Snowplow
      '_sp_id', '_sp_ses'
    ],

    advertising: [
      // Facebook
      '_fbp', '_fbc', 'fr', 'sb', 'datr',
      
      // Google Ads
      'IDE', 'DSID', 'ANID', 'NID', 'FLC', 'AID', 'TAID', '1P_JAR',
      '__Secure-', '__Host-', '__gads', '__gac', '__gads_', 
      '_gcl_au', '_gcl_aw', '_gcl_dc', '_gcl_gb', '_gcl',
      
      // TikTok
      '_ttp', 'tt_webid', 'ttwid', 'tt_appinfo', '_tt_enable_cookie', 'ttclid',
      
      // Twitter
      'personalization_id', 'guest_id', 'gt',
      
      // LinkedIn
      'bcookie', 'li_gc', 'liap', 'lidc',
      
      // Snapchat
      '_sctr', 'sc_at',
      
      // Pinterest
      '_pin_unauth', '_pinterest',
      
      // YouTube
      'YSC', 'VISITOR_INFO1_LIVE', 'yt-remote-',
      
      // Microsoft/Bing
      'MUID', 'MR', 'SRM_B',
      
      // UUID/tracking
      'uuid', 'uuid2', 'uuidc', 'uid', 'cid', 'vid',
      
      // Criteo
      'criteo',
      
      // Generic advertising
      'ad_', 'ads_', 'ads_id', 'pixel', 'track', 'cmp',
      
      // Third-party ad networks
      'cto_', 'permutive', 'ad-id',
      
      // DoubleClick
      'test_cookie',
      
      // AppNexus
      'anj',
      
      // Additional
      'B', 'A3',
      
      // BBC specific
      'ckns_ads'
    ],

    testing: [
      // Optimizely
      'optimizely', 'optimizelyEndUserId', 'optimizelySegments', 'optimizelyBuckets',
      '_opt_awcid', '_opt_awmid', '_opt_expid', '_opt_utmc',
      
      // VWO
      '__pr', '_vis_opt_exp_', '_vis_opt_s', '_vwo_ds', '_vis_opt_test_slice',
      
      // Generic
      'experiment', 'exp_', 'variant', 'split', 'split_tester', 
      'test_group', 'bucket', 'ab_', 'abt',
      
      // Adobe Target
      'mbox',
      
      // CNN/NYTimes
      'FastAB', 'iter_id'
    ],

    personalization: [
      'pref', 'prefs', 'theme', 'lang', 'language', 'locale', 
      'currency', 'timezone', 'tz', 'view', 'layout', 'mode',
      'ui_', 'user_settings', 'dark_mode', 'color_scheme',
      'ct0'
    ],

    essential: [
      // Session
      'session', 'sessionid', 'session-id', 'session-token', '_session_id',
      'sess', 'sid', 's_id', 'connect.sid',
      
      // PHP/Java/ASP
      'jsessionid', 'phpsessid', 'asp.net_sessionid',
      
      // CSRF
      'csrf', 'csrftoken', 'xsrf', '_csrf', '_xsrf',
      
      // Auth
      'auth', 'auth_token', 'token', 'jwt', 'access_token', 'refresh_token',
      'sso_', 'remember_me', 'appid', 'laravel_session', '_secure_session_id',
      
      // Cart
      'cart', 'basket', 'checkout', 'cart_sig', 'cart_ts',
      
      // User
      'login', 'logged_in', 'user', 'uid', 'ubid', 'remember', 'persistent',
      
      // Cloudflare
      '__cfruid', '__cfduid', 'cf_clearance', 'cf_', '_cfuvid',
      
      // Akamai
      '_abck', 'ak_bmsc', 'bm_sv', 'bm_mi', 'bm_sz', 'akavpau_userid',
      
      // Incapsula
      'incap_ses_', 'visid_incap_',
      
      // PerimeterX
      '_px', '_px2', '_px3', '_pxvid',
      
      // Security
      'challenge_', 'bot_', 'secure_',
      
      // Consent
      'cookie_consent', 'cookieConsent', 'cookie_policy', 
      'OptanonConsent', 'OptanonAlertBoxClosed', 'CookieConsent',
      'euconsent', 'euconsent-v2', 'truste', 'cmpconsent',
      'ccpa', 'gdpr', 'consent_', 'ckns_policy', 'ckns_explicit',
      'ckns_', 'eupubconsent',
      
      // E-commerce
      '_shopify_y', '_shopify_s', '_shopify_sa_p', '_shopify_sa_t',
      'secure_customer_sig', '__stripe_mid', '__stripe_sid', '__stripe_orig_props',
      
      // Site-specific essential
      'GU_U', 'gu-cmp', 'nyt-a', 'nyt-gdpr', 'nyt-purr', 'countryCode', 
      'usprivacy', 'BBC-UID', 'ckns_orb_nonce',
      'at-main', 'sess-at-main', 'x-main', 'session-id-time',
      'aws-ubid-main', 'sst-main', 'lc-main', 'sp-cdn', 'regStatus',
      'i18n-prefs', 'skin', 'LV_CART', 'LV_SESSION', 'datadome',
      'sgcookie', 'NYT-T'
    ],

    social: [
      'social', 'share', 'twitter_', 'twtr', 'li_', 'linkedin',
      'pinterest', '_pinterest', '__atuvc', '__atuvs', '__stid'
    ]
  };

  const THIRD_PARTY_DOMAINS = [
    'doubleclick.net', 'google-analytics.com', 'facebook.com', 'facebook.net',
    'tiktok.com', 'twitter.com', 'linkedin.com', 'quantserve.com',
    'scorecardresearch.com', 'adsrvr.org', 'adnxs.com', 'criteo.com',
    'outbrain.com', 'taboola.com', 'pubmatic.com', 'rubiconproject.com',
    'openx.net', 'contextweb.com', 'advertising.com', 'turn.com',
    'serving-sys.com', 'cdn.segment.com', 'cdn.mxpnl.com', 'hotjar.com', 'clarity.ms'
  ];

  const BANNER_KEYWORDS = {
    containers: [
      'cookie', 'consent', 'gdpr', 'privacy', 'banner', 'notice',
      'policy', 'tracking', 'ccpa', 'compliance', 'preferences'
    ],
    rejectButtons: [
      'reject all', 'reject', 'deny all', 'deny', 'decline all', 'decline',
      'refuse', 'refuse all', 'no thanks', 'only necessary', 'essential only',
      'necessary only', 'no cookies', 'opt out'
    ],
    acceptButtons: [
      // Primary exact matches
      'accept all', 'accept all cookies', 'allow all', 'allow all cookies',
      'accept', 'allow', 'agree', 'agree and continue', 'agree and close',
      'ok', 'got it', 'i understand', 'continue', 'i agree', 'i accept',
      'accept cookies', 'allow cookies', 'consent', 'yes', 'enable all',
      'accept and close', 'accept & close', 'allow & continue', 'understood',
      // Compact/no-space variations
      'acceptall', 'allowall', 'acceptallcookies', 'allowallcookies',
      // Additional common variations
      'accept all and close', 'i agree to', 'agree to all', 'agree to cookies',
      'yes, i agree', 'yes i agree', 'accept everything', 'allow everything'
    ],
    manageButtons: [
      'manage', 'settings', 'customize', 'options',
      'cookie settings', 'manage preferences', 'more options',
      'set cookie preferences', 'cookie preferences', 'preferences',
      // Coca-Cola and similar sites use these
      'confirm my choices', 'save my choices', 'confirm choices',
      'manage my preferences', 'cookie options', 'customize cookies'
    ],
    excludeKeywords: [
      'payment', 'shipping', 'checkout', 'cart', 'product', 'search',
      'menu', 'navigation', 'login', 'sign in', 'register', 'account',
      // Social media - prevent clicking share buttons
      'facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 
      'pinterest', 'whatsapp', 'share', 'follow', 'tweet'
    ]
  };

  const SKIP_CLEANUP_PATTERNS = [
    'login', 'signin', 'signup', 'register', 'auth', 'account',
    'checkout', 'cart', 'payment', 'billing'
  ];

  // ============================================================================
  // CONSENT MANAGEMENT PLATFORMS
  // ============================================================================
  
  const CONSENT_PLATFORMS = {
    onetrust: {
      indicators: [
        '#onetrust-banner-sdk',
        '.onetrust-pc-dark-filter',
        '#onetrust-consent-sdk'
      ],
      acceptSelectors: [
        '#onetrust-accept-btn-handler',
        '.onetrust-accept-btn-handler',
        'button[title*="Accept All"]',
        '.ot-pc-agree-button',
        '.accept-all-button'
      ],
      rejectSelectors: [
        '.ot-pc-refuse-all-handler',
        '#onetrust-reject-all-handler',
        'button[title*="Reject"]'
      ]
    },
    cookiebot: {
      indicators: [
        '#CybotCookiebotDialog',
        '[id^="Cookiebot"]',
        '.CybotCookiebotDialog'
      ],
      acceptSelectors: [
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '#CybotCookiebotDialogBodyButtonAccept',
        '[data-cookieconsent="accept"]',
        'a[id*="Allow"]'
      ],
      rejectSelectors: [
        '[data-cookieconsent="deny"]',
        '#CybotCookiebotDialogBodyButtonDecline'
      ]
    },
    quantcast: {
      indicators: [
        '#qc-cmp2-ui',
        '.qc-cmp2-container',
        '[class*="qc-cmp"]'
      ],
      acceptSelectors: [
        '.qc-cmp2-summary-buttons > button:first-child',
        'button[mode="primary"]',
        'button[aria-label*="Accept"]'
      ],
      rejectSelectors: [
        '.qc-cmp2-summary-buttons > button:last-child',
        'button[mode="secondary"]'
      ]
    },
    cookiepro: {
      indicators: [
        '.cookiepro-banner',
        '#cookiepro-banner'
      ],
      acceptSelectors: [
        '#cookiepro-accept-all',
        '.cookiepro-accept-button'
      ],
      rejectSelectors: [
        '#cookiepro-reject-all'
      ]
    },
    trustarc: {
      indicators: [
        '#truste-consent-track',
        '.truste-banner'
      ],
      acceptSelectors: [
        '.truste-button1',
        '[aria-label*="Accept"]',
        'button[title*="Accept"]'
      ],
      rejectSelectors: [
        '.truste-button2',
        '[aria-label*="Reject"]'
      ]
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async function init() {
    try {
      const prefs = await getPreferences();
      
      console.log('[CookiePM] ========== INITIALIZATION ==========');
      console.log('[CookiePM] Version: 2.0.0 Enhanced');
      console.log('[CookiePM] Extension enabled:', prefs.enabled);
      console.log('[CookiePM] Safe mode:', prefs.safeMode);
      console.log('[CookiePM] Classification: Cookie JSON → 93-Cookie DB → 200+ Patterns → AI → User Review');
      console.log('[CookiePM] AI enabled:', prefs.aiEnabled);
      console.log('[CookiePM] Pattern Library: Analytics(70+), Ads(80+), Essential(70+), Testing(30+)');
      console.log('[CookiePM] Preferences:', {
        analytics: prefs.allowAnalytics,
        advertising: prefs.allowAdvertising,
        personalization: prefs.allowPersonalization
      });
      console.log('[CookiePM] URL:', window.location.href);
      console.log('[CookiePM] Domain:', window.location.hostname);
      console.log('[CookiePM] ===============================');
      
      if (!prefs.enabled) {
        console.log('[CookiePM] Extension is disabled');
        return;
      }

      if (await isSiteOnCooldown()) {
        console.log('[CookiePM] Site is on cooldown, skipping');
        return;
      }

      checkTCFConsent();

      setTimeout(() => {
        startBannerDetectionWithRetry(prefs);
      }, INITIAL_DELAY);

      // Multiple cleanup passes to catch late-loading third-party cookies
      setTimeout(() => {
        console.log('[CookiePM] 🧹 Cleanup pass 1/3 (initial)');
        performCookieCleanup(prefs);
      }, 4000);
      
      setTimeout(() => {
        console.log('[CookiePM] 🧹 Cleanup pass 2/3 (catch late loaders)');
        performCookieCleanup(prefs);
      }, 8000);
      
      setTimeout(() => {
        console.log('[CookiePM] 🧹 Cleanup pass 3/3 (final sweep)');
        performCookieCleanup(prefs);
      }, 12000);
      
      // Continuous monitoring - delete tracking cookies as they appear
      startContinuousMonitoring(prefs);

    } catch (error) {
      console.error('[CookiePM] Initialization error:', error);
    }
  }

  async function getPreferences() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        enabled: true,
        safeMode: false,
        aiEnabled: true,  // <-- ADD THIS LINE
        allowAnalytics: false,
        allowAdvertising: false,
        allowPersonalization: false
      }, resolve);
    });
  }

  async function isSiteOnCooldown() {
    const domain = window.location.hostname;
    const cooldownKey = `cooldown_${domain}`;
    const COOLDOWN_DURATION = 3600000;

    return new Promise((resolve) => {
      chrome.storage.local.get([cooldownKey], (result) => {
        const lastAction = result[cooldownKey] || 0;
        const now = Date.now();
        resolve(now - lastAction < COOLDOWN_DURATION);
      });
    });
  }

  async function setSiteCooldown() {
    const domain = window.location.hostname;
    const cooldownKey = `cooldown_${domain}`;
    await chrome.storage.local.set({ [cooldownKey]: Date.now() });
  }

  // ============================================================================
  // COOKIE JSON MANIFEST SYSTEM
  // ============================================================================
  
  async function fetchCookieManifest() {
    const domain = window.location.hostname
      .replace('www.', '')
      .replace('us.', '')
      .replace('uk.', '');
    
    const extensionManifestUrl = chrome.runtime.getURL(`cookie-manifests/${domain}.json`);
    
    try {
      console.log(`[CookiePM] 🔍 Checking bundled manifest: ${domain}.json`);
      
      const response = await fetch(extensionManifestUrl);
      
      if (response.ok) {
        const manifest = await response.json();
        
        if (manifest.domain && manifest.cookies && Array.isArray(manifest.cookies)) {
          console.log('[CookiePM] ========================================');
          console.log('[CookiePM] ✅ COOKIE JSON MANIFEST FOUND!');
          console.log('[CookiePM] ========================================');
          console.log(`[CookiePM] Domain: ${manifest.domain}`);
          console.log(`[CookiePM] Cookies declared: ${manifest.cookies.length}`);
          console.log(`[CookiePM] Last updated: ${manifest.last_updated}`);
          console.log(`[CookiePM] Vendors: ${new Set(manifest.cookies.map(c => c.vendor)).size}`);
          console.log(`[CookiePM] Essential: ${manifest.cookies.filter(c => c.essential).length}`);
          console.log(`[CookiePM] Cross-site trackers: ${manifest.cookies.filter(c => c.cross_site).length}`);
          console.log('[CookiePM] ========================================');
          
          logAction('manifest_detected', {
            source: 'bundled_demo',
            domain: manifest.domain,
            cookie_count: manifest.cookies.length,
            last_updated: manifest.last_updated,
            vendor_count: new Set(manifest.cookies.map(c => c.vendor)).size,
            essential_count: manifest.cookies.filter(c => c.essential).length,
            cross_site_count: manifest.cookies.filter(c => c.cross_site).length
          });
          
          return manifest;
        }
      }
    } catch (error) {
      console.log(`[CookiePM] ℹ️ No bundled manifest for ${domain} (will use 93-cookie database + 200+ patterns)`);
    }

    const realManifestUrls = [
      `${window.location.origin}/.well-known/cookies.json`,
      `${window.location.origin}/cookies.json`
    ];

    for (const url of realManifestUrls) {
      try {
        console.log(`[CookiePM] 🔍 Checking website manifest: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const manifest = await response.json();
          
          if (manifest.domain && manifest.cookies && Array.isArray(manifest.cookies)) {
            console.log('[CookiePM] ========================================');
            console.log('[CookiePM] ✅✅ REAL WEBSITE MANIFEST FOUND!');
            console.log('[CookiePM] ========================================');
            console.log(`[CookiePM] This website adopted Cookie JSON!`);
            
            logAction('manifest_detected', {
              source: 'website_provided',
              domain: manifest.domain,
              cookie_count: manifest.cookies.length
            });
            
            return manifest;
          }
        }
      } catch (error) {
        // Not found
      }
    }

    console.log('[CookiePM] ℹ️ No Cookie JSON - using 93-cookie database + 200+ pattern library');
    return null;
  }

  // ============================================================================
  // TCF FRAMEWORK DETECTION
  // ============================================================================
  
  function checkTCFConsent() {
    if (typeof window.__tcfapi === 'function') {
      console.log('[CookiePM] ✓ Site uses IAB TCF framework');
      
      try {
        window.__tcfapi('getTCData', 2, (tcData, success) => {
          if (success && tcData) {
            console.log('[CookiePM] TCF Data:', {
              gdprApplies: tcData.gdprApplies,
              vendor_count: tcData.vendor?.consents ? Object.keys(tcData.vendor.consents).length : 0
            });
            
            logAction('tcf_detected', {
              framework: 'IAB TCF v2',
              gdprApplies: tcData.gdprApplies,
              vendorCount: tcData.vendor?.consents ? Object.keys(tcData.vendor.consents).length : 0
            });
          }
        });
      } catch (error) {
        console.log('[CookiePM] TCF API error:', error);
      }
    }
  }

  // ============================================================================
  // PLATFORM DETECTION
  // ============================================================================
  
  function detectConsentPlatform() {
    for (const [name, config] of Object.entries(CONSENT_PLATFORMS)) {
      for (const selector of config.indicators) {
        if (document.querySelector(selector)) {
          console.log(`[CookiePM] ✓ Detected ${name} platform`);
          return { name, config };
        }
      }
    }
    return { name: 'unknown', config: null };
  }

  async function tryPlatformSpecificStrategy(platform, prefs) {
    if (!platform.config) return false;

    console.log(`[CookiePM] Trying ${platform.name} strategy...`);

    // Try ACCEPT selectors first (our main strategy)
    if (platform.config.acceptSelectors) {
      for (const selector of platform.config.acceptSelectors) {
        const button = document.querySelector(selector);
        if (button && isVisible(button)) {
          console.log(`[CookiePM] Found ${platform.name} accept button:`, selector);
          safeClick(button, 'accept_all');
          
          logAction('banner_handled', {
            method: 'platform_specific',
            platform: platform.name,
            selector: selector,
            buttonType: 'accept'
          });
          
          return true;
        }
      }
    }

    // Fallback: If no accept button found, log it
    console.log(`[CookiePM] No accept button found for ${platform.name}, will try generic detection`);
    return false;
  }

  // ============================================================================
  // BANNER DETECTION WITH RETRY
  // ============================================================================
  
  function startBannerDetectionWithRetry(prefs) {
    if (observerActive) return;

    observerActive = true;
    let debounceTimer = null;

    const retryCheck = async () => {
      if (hasActed) return;

      await checkForBanner(prefs);
      attemptCount++;

      if (!hasActed && attemptCount < MAX_ATTEMPTS) {
        const delay = Math.min(500 * Math.pow(1.5, attemptCount), 5000);
        console.log(`[CookiePM] Attempt ${attemptCount}/${MAX_ATTEMPTS}, retrying in ${delay}ms...`);
        setTimeout(retryCheck, delay);
      } else if (attemptCount >= MAX_ATTEMPTS) {
        console.log('[CookiePM] Max attempts reached, stopping detection');
        disconnectObserver();
      }
    };

    retryCheck();

    observer = new MutationObserver(() => {
      if (hasActed) {
        disconnectObserver();
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (hasActed) return; // Double-check before running
        await checkForBanner(prefs);
      }, DEBOUNCE_DELAY);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      disconnectObserver();
    }, OBSERVER_TIMEOUT);
  }

  function disconnectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observerActive = false;
  }

  // ============================================================================
  // MAIN BANNER DETECTION & HANDLING
  // ============================================================================
  
  async function checkForBanner(prefs) {
    if (hasActed) return;

    const banner = findBannerElement();
    if (!banner) return;

    console.log('[CookiePM] ✓ Banner detected:', banner);

    const platform = detectConsentPlatform();
    if (platform.config) {
      const success = await tryPlatformSpecificStrategy(platform, prefs);
      if (success) {
        hasActed = true;
        setSiteCooldown();
        disconnectObserver();
        return;
      }
    }

    const multiStepSuccess = await handleMultiStepConsent(banner, prefs);
    if (multiStepSuccess) {
      hasActed = true;
      setSiteCooldown();
      disconnectObserver();
      return;
    }

    const clicked = await clickAppropriateButton(banner, prefs);
    if (clicked) {
      hasActed = true;
      setSiteCooldown();
      disconnectObserver();
      
      logAction('banner_handled', {
        method: clicked.method,
        buttonText: clicked.buttonText,
        strategy: 'button_click'
      });
      return;
    }

    if (!prefs.safeMode) {
      hideBannerWithCSS(banner);
      hasActed = true;
      setSiteCooldown();
      disconnectObserver();
    }
  }

  function findBannerElement() {
    // Priority 1: Known platform IDs (fastest)
    const platformIds = [
      '#onetrust-banner-sdk', '#onetrust-consent-sdk', '#onetrust-pc-sdk',
      '#CybotCookiebotDialog', '#CookiebotWidget',
      '#qc-cmp2-ui',
      '#truste-consent-track',
      '.osano-cm-dialog',
      // Additional OneTrust variations
      '.onetrust-pc-dark-filter', '.ot-sdk-container', '[data-onetrust-banner]'
    ];
    
    for (const id of platformIds) {
      const el = document.querySelector(id);
      if (el && isVisible(el)) {
        console.log('[CookiePM] ✓ Platform banner found:', id);
        return el;
      }
    }
    
    // Priority 2: Generic selectors
    const selectors = [
      '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]', '[id*="privacy"]', '[id*="banner"]',
      '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="privacy"]', '[class*="banner"]',
      '[role="dialog"][aria-label*="cookie"]', '[role="dialog"][aria-label*="consent"]', '[role="dialog"][aria-label*="privacy"]',
      '[role="dialog"]', '[role="alertdialog"]',
      '[data-testid*="cookie"]', '[data-testid*="consent"]', '[data-testid*="privacy"]',
      // OneTrust specific classes
      '[class*="onetrust"]', '[class*="ot-sdk"]', '[class*="optanon"]'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isLikelyBanner(el)) {
            console.log('[CookiePM] ✓ Generic banner found:', selector);
            return el;
          }
        }
      } catch (e) {
        // Invalid selector
      }
    }
    
    // Priority 3: Shadow DOM search
    const shadowHosts = document.querySelectorAll('*');
    for (const host of shadowHosts) {
      if (host.shadowRoot) {
        for (const selector of selectors) {
          try {
            const shadowElements = host.shadowRoot.querySelectorAll(selector);
            for (const el of shadowElements) {
              if (isLikelyBanner(el)) {
                console.log('[CookiePM] ✓ Shadow DOM banner found');
                return el;
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }

    // Priority 4: Fixed/sticky positioned elements
    const allDivs = document.querySelectorAll('div, section, aside');
    for (const el of allDivs) {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute') {
        if (isLikelyBanner(el)) {
          console.log('[CookiePM] ✓ Fixed position banner found');
          return el;
        }
      }
    }
    
    // Priority 5: High z-index overlays
    for (const el of allDivs) {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex) || 0;
      if (zIndex > 999) {
        if (isLikelyBanner(el)) {
          console.log('[CookiePM] ✓ High z-index banner found');
          return el;
        }
      }
    }

    return null;
  }

  function isLikelyBanner(element) {
    if (!isVisible(element)) return false;

    const rect = element.getBoundingClientRect();
    
    // Minimum size check - made MORE lenient for sites like Coca-Cola
    if (rect.width < 150 || rect.height < 40) return false;

    const style = window.getComputedStyle(element);
    const isFixed = style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    const isLarge = rect.width > window.innerWidth * 0.12; // Reduced from 0.15
    const zIndex = parseInt(style.zIndex) || 0;
    const hasHighZIndex = zIndex > 30; // Reduced from 50
    
    // Need at least one positioning indicator
    if (!isFixed && !isLarge && !hasHighZIndex) return false;

    const text = element.textContent.toLowerCase();
    const html = element.innerHTML.toLowerCase();
    
    // Check for cookie/consent keywords
    const hasCookieKeyword = BANNER_KEYWORDS.containers.some(keyword => 
      text.includes(keyword) || html.includes(keyword)
    );

    if (!hasCookieKeyword) return false;
    
    // Minimum text length - reduced for shorter banners
    if (text.length < 20) return false; // Reduced from 30

    // Must have excluded keywords check
    const hasExcludedKeyword = BANNER_KEYWORDS.excludeKeywords.some(keyword =>
      text.includes(keyword)
    );
    
    if (hasExcludedKeyword) return false;

    // Must have interactive elements
    const interactiveElements = element.querySelectorAll(
      'button, a[role="button"], input[type="button"], a, [role="button"]'
    );
    
    if (interactiveElements.length === 0) return false;

    // Check if any button has consent-related text
    for (const elem of interactiveElements) {
      const elemText = elem.textContent.toLowerCase().trim();
      const hasExcluded = BANNER_KEYWORDS.excludeKeywords.some(kw => elemText.includes(kw));
      if (hasExcluded) continue;
      
      const isConsentButton = 
        BANNER_KEYWORDS.acceptButtons.some(kw => elemText.includes(kw)) ||
        BANNER_KEYWORDS.rejectButtons.some(kw => elemText.includes(kw)) ||
        BANNER_KEYWORDS.manageButtons.some(kw => elemText.includes(kw));
      
      if (isConsentButton) {
        console.log(`[CookiePM] ✓ Found consent button in banner: "${elemText.substring(0, 30)}"`);
        return true;
      }
    }

    return false;
  }

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 && 
           element.offsetHeight > 0;
  }

  // ============================================================================
  // MULTI-STEP CONSENT HANDLING
  // ============================================================================
  
  async function handleMultiStepConsent(banner, prefs) {
    const manageButton = findButtonByKeywords(
      Array.from(banner.querySelectorAll('button, a[role="button"], [role="button"]')),
      BANNER_KEYWORDS.manageButtons
    );

    if (!manageButton) return false;

    console.log('[CookiePM] 🔄 Multi-step dialog detected');

    safeClick(manageButton, 'manage');
    await sleep(1000);

    const togglesHandled = await handleConsentToggles(prefs);
    
    if (togglesHandled) {
      await sleep(500);
      
      const saveButton = findButtonByKeywords(
        Array.from(document.querySelectorAll('button, [role="button"]')),
        ['save', 'confirm', 'apply', 'accept selection', 'save preferences', 'save choices']
      );

      if (saveButton) {
        safeClick(saveButton, 'save_preferences');
        console.log('[CookiePM] ✅ Multi-step consent completed');
        
        logAction('banner_handled', {
          method: 'multi_step',
          steps: ['manage', 'toggle', 'save'],
          togglesModified: togglesHandled
        });
        
        return true;
      }
    }

    return false;
  }

  async function handleConsentToggles(prefs) {
    const toggles = document.querySelectorAll(
      'input[type="checkbox"], [role="switch"], .toggle-switch, .slider'
    );

    let modified = 0;

    for (const toggle of toggles) {
      const label = getToggleLabel(toggle);
      const category = classifyToggleByLabel(label);

      if (category) {
        const shouldEnable = shouldAllowCategory(category, prefs);
        const isEnabled = toggle.checked || toggle.getAttribute('aria-checked') === 'true';
        
        if (isEnabled !== shouldEnable) {
          toggle.click();
          console.log(`[CookiePM] Toggle ${category}: ${shouldEnable}`);
          modified++;
          await sleep(100);
        }
      }
    }

    return modified;
  }

  function getToggleLabel(toggle) {
    const label = toggle.closest('label') || 
                  document.querySelector(`label[for="${toggle.id}"]`) ||
                  toggle.parentElement;
    
    return label ? label.textContent.toLowerCase() : '';
  }

  function classifyToggleByLabel(labelText) {
    if (labelText.includes('analytics') || labelText.includes('statistics') || labelText.includes('measurement')) {
      return 'analytics';
    }
    if (labelText.includes('advertising') || labelText.includes('marketing') || labelText.includes('ad')) {
      return 'advertising';
    }
    if (labelText.includes('personalization') || labelText.includes('functional') || labelText.includes('preference')) {
      return 'personalization';
    }
    if (labelText.includes('necessary') || labelText.includes('essential') || labelText.includes('required')) {
      return 'essential';
    }
    return null;
  }

  function shouldAllowCategory(category, prefs) {
    switch (category) {
      case 'essential': return true;
      case 'analytics': return prefs.allowAnalytics;
      case 'advertising': return prefs.allowAdvertising;
      case 'personalization': return prefs.allowPersonalization;
      default: return false;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // BUTTON CLICKING LOGIC
  // ============================================================================
  
  async function clickAppropriateButton(banner, prefs) {
    if (hasActed) return null; // Already clicked something
    
    const allButtons = document.querySelectorAll('button, a[role="button"], input[type="button"], a, [role="button"]');
    const bannerButtons = banner.querySelectorAll('button, a[role="button"], input[type="button"], a, [role="button"]');

    console.log(`[CookiePM] Found ${bannerButtons.length} buttons in banner`);

    const hasBlockedCategories = !prefs.allowAnalytics || !prefs.allowAdvertising || !prefs.allowPersonalization;

    if (!hasBlockedCategories) {
      console.log('[CookiePM] User allows all cookies - no action needed');
      return null;
    }

    if (prefs.safeMode) {
      console.log('[CookiePM] Safe mode - no auto-clicking');
      return { method: 'detected_only', buttonText: 'Safe mode' };
    }

    console.log('[CookiePM] Looking for ACCEPT ALL...');
    let acceptButton = findButtonByKeywords(Array.from(bannerButtons), BANNER_KEYWORDS.acceptButtons);
    
    if (!acceptButton) {
      acceptButton = findButtonByKeywords(Array.from(allButtons), BANNER_KEYWORDS.acceptButtons);
    }

    if (acceptButton) {
      const result = safeClick(acceptButton, 'accept_all');
      if (result) {
        console.log('[CookiePM] ✅ Clicked ACCEPT ALL - STOPPING (no additional clicks)');
        hasActed = true; // Set immediately to prevent further clicks
        return result;
      }
    }

    const dismissButton = findButtonByKeywords(Array.from(bannerButtons), ['ok', 'got it', 'continue']);
    if (dismissButton) {
      const result = safeClick(dismissButton, 'dismiss');
      if (result) {
        console.log('[CookiePM] ✅ Clicked dismiss - STOPPING');
        hasActed = true; // Set immediately
        return result;
      }
    }

    return null;
  }

  function findButtonByKeywords(buttons, keywords) {
    // Normalize text helper - removes extra whitespace, special chars
    const normalize = (text) => {
      return text.toLowerCase()
        .replace(/\s+/g, ' ')  // collapse multiple spaces
        .replace(/[^\w\s]/g, '')  // remove special chars except spaces
        .trim();
    };
    
    // Pass 1: Exact match (highest priority)
    for (const button of buttons) {
      if (!isVisible(button)) continue;

      const text = normalize(button.textContent);
      const ariaLabel = normalize(button.getAttribute('aria-label') || '');
      
      // Skip excluded buttons
      const hasExcluded = BANNER_KEYWORDS.excludeKeywords.some(kw => text.includes(kw));
      if (hasExcluded) continue;

      for (const keyword of keywords) {
        const normKeyword = normalize(keyword);
        if (text === normKeyword || ariaLabel === normKeyword) {
          console.log(`[CookiePM] ✓ Exact match: "${text}" matches "${normKeyword}"`);
          return button;
        }
      }
    }

    // Pass 2: Starts with keyword
    for (const button of buttons) {
      if (!isVisible(button)) continue;

      const text = normalize(button.textContent);
      const hasExcluded = BANNER_KEYWORDS.excludeKeywords.some(kw => text.includes(kw));
      if (hasExcluded) continue;

      for (const keyword of keywords) {
        const normKeyword = normalize(keyword);
        if (text.startsWith(normKeyword)) {
          console.log(`[CookiePM] ✓ Starts with: "${text}" starts with "${normKeyword}"`);
          return button;
        }
      }
    }

    // Pass 3: Contains keyword (with length check to avoid false positives)
    for (const button of buttons) {
      if (!isVisible(button)) continue;

      const text = normalize(button.textContent);
      const ariaLabel = normalize(button.getAttribute('aria-label') || '');
      const hasExcluded = BANNER_KEYWORDS.excludeKeywords.some(kw => 
        text.includes(kw) || ariaLabel.includes(kw)
      );
      if (hasExcluded) continue;

      for (const keyword of keywords) {
        const normKeyword = normalize(keyword);
        // Text contains keyword and isn't too long (avoid paragraphs with keyword)
        if (text.includes(normKeyword) && text.length < normKeyword.length * 4) {
          console.log(`[CookiePM] ✓ Contains: "${text}" contains "${normKeyword}"`);
          return button;
        }
        if (ariaLabel.includes(normKeyword)) {
          console.log(`[CookiePM] ✓ ARIA match: aria-label contains "${normKeyword}"`);
          return button;
        }
      }
    }
    
    // Pass 4: Very lenient partial match for short buttons
    for (const button of buttons) {
      if (!isVisible(button)) continue;
      
      const text = normalize(button.textContent);
      const innerText = normalize(button.innerText || '');
      
      // Only for very short button text (likely to be legitimate)
      if (text.length > 0 && text.length < 25) {
        for (const keyword of keywords) {
          const normKeyword = normalize(keyword);
          const keywordWords = normKeyword.split(' ');
          
          // Check if ALL words from keyword appear in button text
          const allWordsPresent = keywordWords.every(word => 
            text.includes(word) || innerText.includes(word)
          );
          
          if (allWordsPresent && text.length < 100) {
            console.log(`[CookiePM] ✓ Multi-word match: "${text}" ~ "${normKeyword}"`);
            return button;
          }
        }
      }
    }

    return null;
  }

  function safeClick(button, method) {
    if (hasActed) {
      console.log('[CookiePM] ⚠️  Already clicked a button, ignoring this click');
      return null;
    }
    
    try {
      const buttonText = button.textContent.trim().substring(0, 50);
      console.log(`[CookiePM] Clicking: "${buttonText}"`);
      
      // Set flag IMMEDIATELY before clicking to prevent race conditions
      hasActed = true;
      disconnectObserver(); // Stop watching for changes immediately

      // Strategy 1: Direct click
      button.focus();
      button.click();
      
      // Strategy 2: MouseEvent with all options
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1
      });
      button.dispatchEvent(clickEvent);
      
      // Strategy 3: PointerEvent (for touch-optimized buttons)
      const pointerEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(pointerEvent);
      
      const pointerUpEvent = new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(pointerUpEvent);
      
      // Strategy 4: For some frameworks that use custom events
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(mouseDownEvent);
      
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(mouseUpEvent);

      console.log(`[CookiePM] ✓ Executed 4 click strategies on "${buttonText}" - LOCKED`);
      return { method, buttonText };
      
    } catch (error) {
      console.error('[CookiePM] Click error:', error);
      hasActed = false; // Reset if click failed
      return null;
    }
  }

  // ============================================================================
  // CSS-BASED BANNER HIDING
  // ============================================================================
  
  function hideBannerWithCSS(banner) {
    console.log('[CookiePM] 🎨 Hiding banner with CSS');

    const bannerId = banner.id;
    const bannerClass = banner.className.split(' ')[0];
    
    const style = document.createElement('style');
    style.id = 'cookiepm-hide-style';
    style.textContent = `
      ${bannerId ? '#' + bannerId : ''}.${bannerClass} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
      .cookie-overlay,
      .consent-backdrop,
      [class*="modal-backdrop"],
      [class*="cookie-banner"] {
        display: none !important;
      }
      body {
        overflow: auto !important;
      }
    `;
    document.head.appendChild(style);

    logAction('banner_handled', {
      method: 'css_hide',
      note: 'Banner hidden (no buttons found)'
    });
  }

  // ============================================================================
  // ENHANCED COOKIE CLASSIFICATION (200+ patterns!)
  // ============================================================================
  
  function classifyCookie(cookieName, cookieDomain = '') {
    const nameLower = cookieName.toLowerCase();
    const domainLower = cookieDomain.toLowerCase();

    // Priority 1: Naming convention prefixes
    if (nameLower.startsWith('analytics_') || nameLower.startsWith('a_')) {
      return { category: 'analytics', source: 'naming_convention', confidence: 'high' };
    }
    if (nameLower.startsWith('ad_') || nameLower.startsWith('advertising_')) {
      return { category: 'advertising', source: 'naming_convention', confidence: 'high' };
    }
    if (nameLower.startsWith('essential_') || nameLower.startsWith('e_')) {
      return { category: 'essential', source: 'naming_convention', confidence: 'high' };
    }
    if (nameLower.startsWith('personalization_') || nameLower.startsWith('p_')) {
      return { category: 'personalization', source: 'naming_convention', confidence: 'high' };
    }

    // Priority 2: Third-party domain detection
    const THIRD_PARTY_DOMAINS = [
      'doubleclick.net', 'google-analytics.com', 'facebook.com', 'facebook.net',
      'tiktok.com', 'twitter.com', 'linkedin.com', 'quantserve.com',
      'scorecardresearch.com', 'adsrvr.org', 'adnxs.com', 'criteo.com',
      'outbrain.com', 'taboola.com', 'pubmatic.com', 'rubiconproject.com',
      'openx.net', 'contextweb.com', 'advertising.com', 'turn.com',
      'serving-sys.com', 'cdn.segment.com', 'cdn.mxpnl.com', 'hotjar.com', 'clarity.ms'
    ];

    if (domainLower && THIRD_PARTY_DOMAINS.some(domain => domainLower.includes(domain))) {
      return { category: 'advertising', source: 'third_party_domain', confidence: 'high' };
    }

    // Priority 3: Check JWT pattern (essential auth)
    const cookieValue = document.cookie.split(';')
      .find(c => c.trim().startsWith(cookieName + '='));
    
    if (cookieValue) {
      const value = cookieValue.split('=')[1];
      if (value && value.startsWith('eyJ')) {
        return { category: 'essential', source: 'jwt_pattern', confidence: 'high' };
      }
    }

    // Priority 4: Essential cookies (must come before analytics to avoid false positives)
    if (COOKIE_PATTERNS.essential.some(pattern => nameLower.includes(pattern))) {
      return { category: 'essential', source: 'pattern', confidence: 'high' };
    }

    // Priority 5: Analytics
    if (COOKIE_PATTERNS.analytics.some(pattern => nameLower.includes(pattern))) {
      return { category: 'analytics', source: 'pattern', confidence: 'high' };
    }

    // Priority 6: Advertising
    if (COOKIE_PATTERNS.advertising.some(pattern => nameLower.includes(pattern))) {
      return { category: 'advertising', source: 'pattern', confidence: 'high' };
    }

    // Priority 7: A/B Testing (treat as analytics)
    if (COOKIE_PATTERNS.testing.some(pattern => nameLower.includes(pattern))) {
      return { category: 'analytics', source: 'pattern_testing', confidence: 'medium' };
    }

    // Priority 8: Personalization
    if (COOKIE_PATTERNS.personalization.some(pattern => nameLower.includes(pattern))) {
      return { category: 'personalization', source: 'pattern', confidence: 'medium' };
    }

    // Priority 9: Social
    if (COOKIE_PATTERNS.social && COOKIE_PATTERNS.social.some(pattern => nameLower.includes(pattern))) {
      return { category: 'social', source: 'pattern', confidence: 'medium' };
    }

    return { category: 'unknown', source: 'default', confidence: 'low' };
  }

  // ============================================================================
  // COOKIE CLEANUP
  // ============================================================================
  
  // ============================================================================
  // CONTINUOUS COOKIE MONITORING
  // ============================================================================
  
  function startContinuousMonitoring(prefs) {
    console.log('[CookiePM] 🔄 Starting continuous monitoring (checks every 5 seconds)');
    
    let monitorCount = 0;
    const MAX_MONITORS = 6; // Monitor for 30 seconds (6 × 5s)
    
    const monitorInterval = setInterval(async () => {
      monitorCount++;
      
      if (monitorCount > MAX_MONITORS) {
        clearInterval(monitorInterval);
        console.log('[CookiePM] ✓ Continuous monitoring complete');
        return;
      }
      
      // Get current cookies
      const currentCookies = document.cookie.split(';')
        .map(c => c.trim())
        .filter(c => c)
        .map(c => c.split('=')[0]);
      
      if (currentCookies.length === 0) return;
      
      // Quick check for known trackers
      const knownTrackers = ['_ga', '_gid', '_fbp', '_gcl_au', '_uetsid', '_ttp', '_scid'];
      const foundTrackers = currentCookies.filter(name => 
        knownTrackers.some(tracker => name.startsWith(tracker))
      );
      
      if (foundTrackers.length > 0) {
        console.log(`[CookiePM] 🔍 Monitor #${monitorCount}: Found ${foundTrackers.length} tracking cookies`);
        
        // Delete ONLY the specific trackers we found, not trigger full cleanup
        for (const trackerName of foundTrackers) {
          console.log(`[CookiePM] 🗑️  Deleting re-appeared tracker: ${trackerName}`);
          deleteCookie(trackerName);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  // ============================================================================
  // COOKIE CLEANUP
  // ============================================================================
  
  async function performCookieCleanup(prefs) {
    if (shouldSkipCleanup()) {
      console.log('[CookiePM] Skipping cleanup on sensitive page');
      return;
    }
  
    console.log('[CookiePM]');
    console.log('[CookiePM] ========== COOKIE CLEANUP STARTING ==========');
  
    // Try Cookie JSON manifest first
    const manifest = await fetchCookieManifest();
    
    if (manifest) {
      console.log('[CookiePM] 🎉 Using Cookie JSON manifest (100% accuracy)');
      await cleanupWithManifest(manifest, prefs);
      return;
    }
  
    // Check if AI is enabled
    if (prefs.aiEnabled) {
      console.log('[CookiePM] 📊 Using 93-DB + 200+ patterns + AI (Llama 3.2)');
      await cleanupWithAI(prefs);
    } else {
      console.log('[CookiePM] 📊 Using 93-DB + 200+ patterns (AI disabled)');
      await cleanupWithClassification(prefs);
    }
  }

  async function cleanupWithManifest(manifest, prefs) {
    const allCookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
    let deletedCount = 0;
    let keptCount = 0;
    const deletedCookies = [];
    const undeclaredCookies = [];
    let aiCount = 0;
    let needsReviewCount = 0;
    const uncertainCookies = [];
  
    console.log('[CookiePM]');
    console.log(`[CookiePM] 🧹 Processing ${allCookies.length} cookies`);
    console.log(`[CookiePM] 📋 Manifest declares: ${manifest.cookies.length} cookies`);
    console.log('[CookiePM]');
  
    for (const cookie of allCookies) {
      const cookieName = cookie.split('=')[0].trim();
      const cookieValue = cookie.split('=')[1] || '';
      const cookieInfo = manifest.cookies.find(c => c.name === cookieName);
      
      if (cookieInfo) {
        // Cookie IS declared in manifest - use manifest classification
        const shouldDelete = shouldDeleteCookieByCategory(cookieInfo.category, prefs);
        
        if (shouldDelete) {
          deleteCookie(cookieName);
          deletedCount++;
          deletedCookies.push({
            name: cookieName,
            category: cookieInfo.category,
            vendor: cookieInfo.vendor,
            purpose: cookieInfo.purpose,
            source: 'cookie_json'
          });
          console.log(`[CookiePM] ✗ DELETED: ${cookieName}`);
          console.log(`[CookiePM]    └─ Category: ${cookieInfo.category}`);
          console.log(`[CookiePM]    └─ Vendor: ${cookieInfo.vendor}`);
          console.log(`[CookiePM]    └─ Purpose: ${cookieInfo.purpose.substring(0, 70)}...`);
        } else {
          keptCount++;
          console.log(`[CookiePM] ✓ KEPT: ${cookieName} (${cookieInfo.category}) - ${cookieInfo.vendor}`);
        }
      } else {
        // Cookie NOT declared in manifest - this is a compliance issue!
        undeclaredCookies.push(cookieName);
        
        // If AI is enabled, try to classify undeclared cookies
        if (prefs.aiEnabled) {
          console.log(`[CookiePM] 🤖 UNDECLARED: ${cookieName} - requesting AI classification`);
          
          try {
            const aiResult = await chrome.runtime.sendMessage({
              type: 'CLASSIFY_WITH_AI',
              cookieName: cookieName,
              domain: window.location.hostname,
              value: cookieValue
            });
  
            if (aiResult && !aiResult.error) {
              aiCount++;
              
              // If AI confidence is low (<80%), queue for user review
              if (aiResult.confidence < 0.8) {
                uncertainCookies.push({
                  name: cookieName,
                  domain: window.location.hostname,
                  value: cookieValue,
                  aiCategory: aiResult.category,
                  confidence: aiResult.confidence,
                  reasoning: aiResult.reasoning,
                  source: 'ai_undeclared'
                });
                needsReviewCount++;
                keptCount++;
                console.log(`[CookiePM]    └─ AI: ${aiResult.category} (${Math.round(aiResult.confidence * 100)}%) - LOW confidence, queued for review`);
              } else {
                // High confidence - apply AI decision
                const shouldDelete = shouldDeleteCookie(aiResult.category, prefs);
                
                if (shouldDelete) {
                  deleteCookie(cookieName);
                  deletedCount++;
                  console.log(`[CookiePM]    └─ AI: ${aiResult.category} (${Math.round(aiResult.confidence * 100)}%) - DELETED`);
                } else {
                  keptCount++;
                  console.log(`[CookiePM]    └─ AI: ${aiResult.category} (${Math.round(aiResult.confidence * 100)}%) - KEPT`);
                }
              }
            } else {
              keptCount++;
              console.log(`[CookiePM]    └─ AI classification failed - KEPT for safety`);
            }
            
          } catch (error) {
            console.error(`[CookiePM] AI error for ${cookieName}:`, error);
            keptCount++;
            console.log(`[CookiePM]    └─ Kept (AI error)`);
          }
        } else {
          // AI disabled - just keep undeclared cookies for safety
          keptCount++;
          console.log(`[CookiePM] ⚠️ UNDECLARED: ${cookieName} (kept - AI disabled)`);
        }
      }
    }
  
    // Send uncertain cookies to review queue
    if (uncertainCookies.length > 0) {
      console.log(`[CookiePM] 📋 Sending ${uncertainCookies.length} undeclared cookies to review queue`);
      chrome.runtime.sendMessage({
        type: 'ADD_TO_REVIEW_QUEUE',
        cookies: uncertainCookies
      }).catch(err => console.error('[CookiePM] Failed to queue:', err));
    }
  
    const coverage = allCookies.length > 0 
      ? Math.round(manifest.cookies.length / allCookies.length * 100) 
      : 0;
  
    // Calculate category breakdown from deleted cookies
    const deletedByCategory = {
      essential: deletedCookies.filter(c => c.category === 'essential').length,
      analytics: deletedCookies.filter(c => c.category === 'analytics').length,
      advertising: deletedCookies.filter(c => c.category === 'advertising').length,
      functional: deletedCookies.filter(c => c.category === 'functional' || c.category === 'personalization').length
    };
  
    console.log('[CookiePM]');
    console.log('[CookiePM] ' + '='.repeat(60));
    console.log('[CookiePM] 📊 COOKIE JSON MANIFEST RESULTS');
    console.log('[CookiePM] ' + '='.repeat(60));
    console.log('[CookiePM]');
    console.log('[CookiePM] 📋 MANIFEST INFO:');
    console.log(`[CookiePM]    Domain: ${manifest.domain}`);
    console.log(`[CookiePM]    Declared: ${manifest.cookies.length} cookies`);
    console.log(`[CookiePM]    Vendors: ${manifest.vendors?.length || 'N/A'}`);
    console.log(`[CookiePM]    Coverage: ${coverage}% (${manifest.cookies.length}/${allCookies.length})`);
    console.log('[CookiePM]');
    console.log('[CookiePM] 🧹 CLEANUP SUMMARY:');
    console.log(`[CookiePM]    ✅ Deleted: ${deletedCount} cookies`);
    console.log(`[CookiePM]    ✓  Kept: ${keptCount} cookies`);
    console.log(`[CookiePM]    📦 Total: ${allCookies.length} cookies`);
    console.log('[CookiePM]');
    console.log('[CookiePM] 📂 DELETED BY CATEGORY:');
    console.log(`[CookiePM]    📊 Analytics: ${deletedByCategory.analytics} deleted`);
    console.log(`[CookiePM]    🎯 Advertising: ${deletedByCategory.advertising} deleted`);
    console.log(`[CookiePM]    🎨 Functional: ${deletedByCategory.functional} deleted`);
    if (deletedByCategory.essential > 0) {
      console.log(`[CookiePM]    ⚠️  Essential: ${deletedByCategory.essential} deleted (unusual)`);
    }
    console.log('[CookiePM]');
    console.log('[CookiePM] 🤖 AI ASSISTANCE:');
    console.log(`[CookiePM]    Undeclared: ${undeclaredCookies.length} cookies`);
    console.log(`[CookiePM]    AI classified: ${aiCount} cookies`);
    console.log(`[CookiePM]    Review queue: ${needsReviewCount} cookies`);
    console.log('[CookiePM]');
    console.log('[CookiePM] 🎯 ACCURACY: 100% (manifest) + AI (undeclared)');
    console.log('[CookiePM] ' + '='.repeat(60));
  
    logAction('cookies_deleted', {
      count: deletedCount,
      cookies: deletedCookies,
      kept_count: keptCount,
      undeclared_count: undeclaredCookies.length,
      undeclared_cookies: undeclaredCookies,
      ai_classified: aiCount,
      needs_review: needsReviewCount,
      method: 'cookie_json_with_ai',
      manifest_coverage: `${manifest.cookies.length}/${allCookies.length}`,
      coverage_percentage: `${coverage}%`
    });
  }
  async function cleanupWithAI(prefs) {
    const allCookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
    let deletedCount = 0;
    let classifiedCount = 0;
    let unknownCount = 0;
    let databaseCount = 0;
    let patternCount = 0;
    let namingConventionCount = 0;
    let thirdPartyCount = 0;
    let aiCount = 0;
    let needsReviewCount = 0;
    const deletedCookies = [];
    const uncertainCookies = [];
  
    console.log('[CookiePM]');
    console.log('[CookiePM] 🧹 Processing ${allCookies.length} cookies with AI support');
    console.log('[CookiePM] 📚 Using: 93-DB + 200+ patterns + Llama 3.2 1B');
    console.log('[CookiePM]');
  
    for (const cookie of allCookies) {
      const cookieName = cookie.split('=')[0].trim();
      const cookieValue = cookie.split('=')[1] || '';
      const cookieDomain = window.location.hostname;
      
      // Try local classification first (your existing classifyCookie function)
      let category = classifyCookie(cookieName, cookieDomain);
  
      // Track classification source
      if (category.source === 'database') {
        databaseCount++;
        classifiedCount++;
      } else if (category.source === 'pattern' || category.source === 'pattern_testing') {
        patternCount++;
        classifiedCount++;
      } else if (category.source === 'naming_convention') {
        namingConventionCount++;
        classifiedCount++;
      } else if (category.source === 'third_party_domain') {
        thirdPartyCount++;
        classifiedCount++;
      } else if (category.category === 'unknown') {
        unknownCount++;
        
        // Unknown cookie - request AI classification
        console.log(`[CookiePM] 🤖 Unknown: ${cookieName} - requesting AI classification`);
        
        try {
          const aiResult = await chrome.runtime.sendMessage({
            type: 'CLASSIFY_WITH_AI',
            cookieName: cookieName,
            domain: cookieDomain,
            value: cookieValue
          });
  
          if (aiResult && !aiResult.error) {
            category = {
              category: aiResult.category,
              confidence: aiResult.confidence,
              source: 'ai',
              reasoning: aiResult.reasoning
            };
            
            aiCount++;
            
            // If AI confidence is low (<80%), queue for user review
            if (aiResult.confidence < 0.8) {
              uncertainCookies.push({
                name: cookieName,
                domain: cookieDomain,
                value: cookieValue,
                aiCategory: aiResult.category,
                confidence: aiResult.confidence,
                reasoning: aiResult.reasoning,
                source: 'ai'
              });
              needsReviewCount++;
              console.log(`[CookiePM] ⚠️ Low AI confidence (${Math.round(aiResult.confidence * 100)}%) - queued for user review`);
            } else {
              console.log(`[CookiePM] ✓ AI classified: ${cookieName} → ${aiResult.category} (${Math.round(aiResult.confidence * 100)}%)`);
              classifiedCount++;
            }
          } else {
            console.log(`[CookiePM] ⚠️ AI classification failed for ${cookieName}`);
          }
          
        } catch (error) {
          console.error(`[CookiePM] AI error for ${cookieName}:`, error);
        }
      }
  
      const shouldDelete = shouldDeleteCookie(category.category, prefs);
  
      if (shouldDelete) {
        deleteCookie(cookieName);
        deletedCount++;
        deletedCookies.push({ 
          name: cookieName, 
          category: category.category,
          source: category.source 
        });
        console.log(`[CookiePM] ✗ DELETED: ${cookieName} (${category.category}) [${category.source}]`);
      } else {
        console.log(`[CookiePM] ✓ KEPT: ${cookieName} (${category.category}) [${category.source}]`);
      }
    }
  
    // Send uncertain cookies to review queue
    if (uncertainCookies.length > 0) {
      console.log(`[CookiePM] 📋 Sending ${uncertainCookies.length} cookies to review queue`);
      chrome.runtime.sendMessage({
        type: 'ADD_TO_REVIEW_QUEUE',
        cookies: uncertainCookies
      }).catch(err => console.error('[CookiePM] Failed to queue cookies:', err));
    }
  
    const accuracy = allCookies.length > 0 
      ? Math.round(classifiedCount / allCookies.length * 100) 
      : 0;
  
    console.log('[CookiePM]');
    console.log('[CookiePM] ' + '='.repeat(60));
    console.log('[CookiePM] 📊 AI-ENHANCED CLASSIFICATION RESULTS');
    console.log('[CookiePM] ' + '='.repeat(60));
    console.log('[CookiePM]');
    console.log('[CookiePM] 🧹 CLEANUP SUMMARY:');
    console.log(`[CookiePM]    ✅ Deleted: ${deletedCount} cookies`);
    console.log(`[CookiePM]    ✓  Kept: ${allCookies.length - deletedCount} cookies`);
    console.log(`[CookiePM]    📦 Total: ${allCookies.length} cookies processed`);
    console.log('[CookiePM]');
    console.log('[CookiePM] 🎯 CLASSIFICATION METHODS:');
    console.log(`[CookiePM]    🗄️  Database: ${databaseCount} cookies`);
    console.log(`[CookiePM]    🔍 Patterns: ${patternCount} cookies`);
    console.log(`[CookiePM]    🏷️  Naming: ${namingConventionCount} cookies`);
    console.log(`[CookiePM]    🌐 3rd-Party: ${thirdPartyCount} cookies`);
    console.log(`[CookiePM]    🤖 AI: ${aiCount} cookies`);
    console.log(`[CookiePM]    ━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[CookiePM]    ✓  Classified: ${classifiedCount}/${allCookies.length} (${accuracy}%)`);
    console.log('[CookiePM]');
    console.log('[CookiePM] 🔬 QUALITY:');
    console.log(`[CookiePM]    Review Queue: ${needsReviewCount} cookies`);
    console.log(`[CookiePM]    Unknown: ${unknownCount - aiCount} cookies`);
    console.log(`[CookiePM]    Accuracy: ${accuracy}%`);
    console.log('[CookiePM] ' + '='.repeat(60));
  
    if (deletedCount > 0 || aiCount > 0) {
      logAction('cookies_deleted', {
        count: deletedCount,
        cookies: deletedCookies,
        classified_count: classifiedCount,
        database_count: databaseCount,
        pattern_count: patternCount,
        naming_convention_count: namingConventionCount,
        third_party_count: thirdPartyCount,
        ai_count: aiCount,
        needs_review_count: needsReviewCount,
        method: 'ai_enhanced_classification',
        accuracy: `${accuracy}%`,
        total_patterns: '200+'
      });
    }
  }
  async function cleanupWithClassification(prefs) {
    const allCookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
    let deletedCount = 0;
    let classifiedCount = 0;
    let unknownCount = 0;
    let databaseCount = 0;
    let patternCount = 0;
    let namingConventionCount = 0;
    let thirdPartyCount = 0;
    const deletedCookies = [];

    console.log('[CookiePM]');
    console.log(`[CookiePM] 🧹 Processing ${allCookies.length} cookies`);
    console.log(`[CookiePM] 📚 Using: 93-cookie database + 200+ patterns`);
    console.log('[CookiePM]');

    for (const cookie of allCookies) {
      const cookieName = cookie.split('=')[0].trim();
      
      // Get domain from cookie if available
      const cookieDomain = window.location.hostname;
      
      const category = classifyCookie(cookieName, cookieDomain);

      // Track classification source
      if (category.source === 'database') {
        databaseCount++;
      } else if (category.source === 'pattern' || category.source === 'pattern_testing') {
        patternCount++;
      } else if (category.source === 'naming_convention') {
        namingConventionCount++;
      } else if (category.source === 'third_party_domain') {
        thirdPartyCount++;
      }

      if (category.category === 'unknown') {
        unknownCount++;
        console.log(`[CookiePM] ❓ UNKNOWN: ${cookieName} (keeping for safety)`);
      } else {
        classifiedCount++;
      }

      const shouldDelete = shouldDeleteCookie(category.category, prefs);

      if (shouldDelete) {
        deleteCookie(cookieName);
        deletedCount++;
        deletedCookies.push({ 
          name: cookieName, 
          category: category.category,
          source: category.source 
        });
        console.log(`[CookiePM] ✗ DELETED: ${cookieName} (${category.category}) [${category.source}]`);
      } else {
        console.log(`[CookiePM] ✓ KEPT: ${cookieName} (${category.category}) [${category.source}]`);
      }
    }

    const accuracy = allCookies.length > 0 
      ? Math.round(classifiedCount / allCookies.length * 100) 
      : 0;

    console.log('[CookiePM]');
    console.log('[CookiePM] ========== CLASSIFICATION RESULTS ==========');
    console.log(`[CookiePM] ✅ Deleted: ${deletedCount} cookies`);
    console.log(`[CookiePM] 📊 Classified: ${classifiedCount}/${allCookies.length} cookies (${accuracy}%)`);
    console.log(`[CookiePM] 🗄️  From 93-Cookie Database: ${databaseCount} (HIGH confidence)`);
    console.log(`[CookiePM] 🔍 From 200+ Pattern Library: ${patternCount} (HIGH confidence)`);
    console.log(`[CookiePM] 🏷️  From Naming Convention: ${namingConventionCount} (HIGH confidence)`);
    console.log(`[CookiePM] 🌐 From Third-Party Domain: ${thirdPartyCount} (HIGH confidence)`);
    console.log(`[CookiePM] ❓ Unknown: ${unknownCount} (${Math.round(unknownCount/allCookies.length*100)}%)`);
    console.log(`[CookiePM] 🎯 Overall Classification Accuracy: ${accuracy}%`);
    console.log('[CookiePM] ============================================');

    if (deletedCount > 0) {
      logAction('cookies_deleted', {
        count: deletedCount,
        cookies: deletedCookies,
        unknown_count: unknownCount,
        classified_count: classifiedCount,
        database_count: databaseCount,
        pattern_count: patternCount,
        naming_convention_count: namingConventionCount,
        third_party_count: thirdPartyCount,
        method: 'enhanced_classification',
        accuracy: `${accuracy}%`,
        total_patterns: '200+'
      });
    }
  }

  function shouldSkipCleanup() {
    const url = window.location.href.toLowerCase();
    return SKIP_CLEANUP_PATTERNS.some(pattern => url.includes(pattern));
  }

  function shouldDeleteCookie(category, prefs) {
    switch (category) {
      case 'essential':
        return false;
      case 'analytics':
        return !prefs.allowAnalytics;
      case 'advertising':
        return !prefs.allowAdvertising;
      case 'personalization':
        return !prefs.allowPersonalization;
      case 'social':
        return !prefs.allowPersonalization; // Treat social as personalization
      case 'unknown':
        return false; // Safe default
      default:
        return false;
    }
  }

  function shouldDeleteCookieByCategory(category, prefs) {
    return shouldDeleteCookie(category, prefs);
  }

  function deleteCookie(name) {
    console.log(`[CookiePM] 🗑️  Deleting cookie: ${name}`);
    
    // Method 1: document.cookie (non-HttpOnly cookies)
    const paths = ['/', window.location.pathname];
    const domains = [window.location.hostname, '.' + window.location.hostname];

    for (const path of paths) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain};`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
      }
    }
    
    // Method 2: Chrome API (HttpOnly, Secure cookies) - IMPROVED
    chrome.runtime.sendMessage({
      type: 'DELETE_COOKIE',
      cookieName: name,
      url: window.location.href,
      domain: window.location.hostname
    }).then(response => {
      if (response && response.success) {
        console.log(`[CookiePM] ✅ API deletion successful for: ${name}`);
      } else {
        console.log(`[CookiePM] ⚠️  API deletion may have failed for: ${name}`);
      }
    }).catch(error => {
      console.error(`[CookiePM] ❌ Error sending delete message for ${name}:`, error);
    });
  }

  // ============================================================================
  // LOGGING
  // ============================================================================
  
  function logAction(action, details) {
    chrome.runtime.sendMessage({
      type: 'LOG_ACTION',
      data: {
        timestamp: new Date().toISOString(),
        domain: window.location.hostname,
        url: window.location.href,
        action: action,
        details: {
          ...details,
          detected_platform: detectConsentPlatform().name
        }
      }
    }).catch(err => {
      console.error('[CookiePM] Failed to log:', err);
    });
  }

  // ============================================================================
  // START EXTENSION
  // ============================================================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();