# Cookie Preference Manager

A powerful Chrome extension that automatically manages cookie consent banners and intelligently classifies and deletes tracking cookies based on your preferences. Features AI-enhanced classification using Groq's Llama 3.1 model and supports the emerging Cookie JSON manifest standard.

## 🎯 Features

### Automatic Cookie Consent Management
- **Smart Banner Detection**: Automatically detects and handles cookie consent banners across websites
- **Multi-Platform Support**: Works with OneTrust, Cookiebot, Quantcast, CookiePro, TrustArc, and generic banners
- **Intelligent Button Clicking**: Finds and clicks "Accept All" or "Reject All" buttons based on your preferences
- **Multi-Step Consent Handling**: Navigates complex multi-step consent dialogs
- **CSS Fallback**: Hides banners when buttons aren't found

### Advanced Cookie Classification
The extension uses a multi-layered classification system for maximum accuracy:

1. **Cookie JSON Manifest** (100% accuracy)
   - Supports the emerging Cookie JSON standard (`/.well-known/cookies.json`)
   - Includes bundled manifests for major sites (Amazon, BBC, CNN, NYTimes, The Guardian, Louis Vuitton)
   - Automatically detects and uses website-provided manifests

2. **93-Cookie Database**
   - Pre-classified database of common cookies from major websites
   - High-confidence classifications

3. **200+ Pattern Library**
   - Analytics patterns (70+): Google Analytics, Hotjar, Adobe Analytics, Mixpanel, etc.
   - Advertising patterns (80+): Facebook Pixel, Google Ads, TikTok, LinkedIn, etc.
   - Essential patterns (70+): Session, CSRF, authentication, security cookies
   - Testing patterns (30+): Optimizely, VWO, A/B testing cookies
   - Personalization patterns: User preferences, themes, language settings

4. **AI Classification** (Optional)
   - Uses Groq's Llama 3.1 8B Instant model (FREE, fast)
   - Classifies unknown cookies with confidence scores
   - Low-confidence cookies (<80%) are queued for user review

### Cookie Management
- **Real-Time Blocking**: Intercepts and blocks cookies as they're created
- **Continuous Monitoring**: Monitors for re-appearing tracking cookies
- **Smart Deletion**: Deletes cookies across all stores (normal + incognito)
- **Category-Based Control**: Granular control over analytics, advertising, and personalization cookies
- **Essential Cookie Protection**: Always preserves essential cookies (login, cart, security)

### User Interface
- **Popup Dashboard**: Quick access to preferences and review queue
- **Review Queue**: Manually review cookies with low AI confidence
- **Activity Logs**: Track all extension actions with detailed logging
- **Banner Counter**: See how many consent banners were handled today/lifetime
- **Settings Page**: Comprehensive options and activity log viewer

## 📦 Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `CookieConsent` folder

### Configuration

1. Click the extension icon in your Chrome toolbar
2. Configure your cookie preferences:
   - **Analytics Cookies**: Allow/block Google Analytics, visitor tracking
   - **Advertising Cookies**: Allow/block ad targeting, Facebook Pixel, Google Ads
   - **Personalization Cookies**: Allow/block language, theme, preferences
3. Enable/disable AI classification (requires Groq API key)
4. Toggle Safe Mode (detect only, don't auto-click)

## ⚙️ Configuration

### Groq API Setup (Optional - for AI Classification)

1. Get a free API key from [Groq](https://console.groq.com/)
2. Open `background.js`
3. Replace the empty `GROQ_API_KEY` constant with your API key:
   ```javascript
   const GROQ_API_KEY = 'your-api-key-here';
   ```
4. AI classification will automatically activate for unknown cookies

**Note**: The extension works perfectly without AI - it will use the 93-cookie database and 200+ patterns instead.

### Preferences

- **Extension Enabled**: Master toggle to enable/disable the extension
- **AI Classification**: Enable AI-powered classification for unknown cookies
- **Safe Mode**: Detect banners but don't auto-click (manual review only)
- **Analytics Cookies**: Allow or block analytics/tracking cookies
- **Advertising Cookies**: Allow or block advertising/targeting cookies
- **Personalization Cookies**: Allow or block personalization cookies

## 🏗️ Architecture

### Files Structure

```
CookieConsent/
├── manifest.json              # Extension manifest (Chrome Extension v3)
├── background.js              # Service worker (cookie deletion, AI, storage)
├── content.js                 # Content script (banner detection, cookie cleanup)
├── popup.html/js              # Extension popup UI
├── options.html/js            # Options page (activity logs)
├── styles.css                 # Main stylesheet
├── ai-review.css              # Review queue styles
├── cookieData.json            # 93-cookie database
├── cookie-manifests/          # Bundled Cookie JSON manifests
│   ├── amazon.com.json
│   ├── bbc.com.json
│   ├── cnn.com.json
│   ├── nytimes.com.json
│   ├── theguardian.com.json
│   └── louisvuitton.com.json
└── icons/
    └── icon128.png
```

### Key Components

**Background Service Worker** (`background.js`):
- Manages cookie deletion via Chrome API
- Handles AI classification requests
- Manages review queue
- Tracks banner counts
- Activity logging

**Content Script** (`content.js`):
- Detects cookie consent banners
- Performs cookie cleanup
- Classifies cookies using multiple methods
- Handles banner interactions

**Cookie Classification Flow**:
```
Cookie Detected
    ↓
1. Check Cookie JSON Manifest (if available)
    ↓ (not found)
2. Check 93-Cookie Database
    ↓ (not found)
3. Check 200+ Pattern Library
    ↓ (not found)
4. AI Classification (if enabled)
    ↓ (low confidence)
5. Queue for User Review
```

## 🔍 Cookie JSON Manifest Support

This extension supports the emerging [Cookie JSON](https://github.com/cookie-json/cookie-json) standard, which allows websites to declare their cookies in a standardized format.

### How It Works

1. Extension checks for `/.well-known/cookies.json` on each website
2. If found, uses manifest data for 100% accurate classification
3. Falls back to bundled manifests for supported sites
4. Uses database + patterns + AI for sites without manifests

### Example Manifest

```json
{
  "domain": "example.com",
  "cookies": [
    {
      "name": "_ga",
      "category": "analytics",
      "vendor": "Google",
      "purpose": "Analytics tracking",
      "essential": false,
      "cross_site": true
    }
  ]
}
```

## 📊 Statistics & Logging

- **Banner Counter**: Tracks consent banners handled (daily + lifetime)
- **Activity Logs**: Detailed logs of all extension actions
- **Review Queue**: Cookies needing manual review (low AI confidence)
- **Export Options**: Export logs as JSON or CSV

## 🛡️ Privacy & Security

- **Local Processing**: Cookie classification happens locally when possible
- **No Data Collection**: Extension doesn't collect or transmit your browsing data
- **Incognito Support**: Separate logging for incognito mode
- **Essential Cookie Protection**: Never deletes essential cookies (login, cart, security)
- **Safe Defaults**: Unknown cookies are kept by default (not deleted)

## 🚀 Performance

- **Fast Classification**: Pattern matching is instant
- **Efficient AI**: Groq API provides ~500 tokens/second
- **Minimal Overhead**: Lightweight content script
- **Smart Cooldowns**: Prevents repeated actions on same site

## 🐛 Troubleshooting

### Extension Not Working

1. Check if extension is enabled in popup
2. Verify preferences are saved
3. Check browser console for errors (F12)
4. Ensure you're not in Safe Mode if expecting auto-clicks

### Cookies Not Being Deleted

1. Some cookies are HttpOnly and cannot be deleted via JavaScript
2. Extension uses Chrome API as fallback
3. Check activity logs to see deletion attempts
4. Some sites recreate cookies faster than they can be deleted

### AI Classification Not Working

1. Verify Groq API key is set in `background.js`
2. Check API key validity
3. Review console logs for API errors
4. Extension works fine without AI (uses patterns instead)

## 📝 Development

### Building from Source

No build process required - extension runs directly from source files.

### Adding Cookie Patterns

Edit `content.js` and add patterns to the `COOKIE_PATTERNS` object:

```javascript
const COOKIE_PATTERNS = {
  analytics: [
    // Add your patterns here
    'your_pattern'
  ],
  // ... other categories
};
```

### Adding Cookie JSON Manifests

1. Create a JSON file in `cookie-manifests/` named `domain.com.json`
2. Follow the Cookie JSON schema
3. Update `manifest.json` to include the file in `web_accessible_resources`


**Version**: 2.0.0  
**Last Updated**: 2024  
**Chrome Extension Manifest**: v3

