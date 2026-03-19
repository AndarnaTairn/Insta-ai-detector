# AI Image Detector

Automatically detect AI-generated images on Instagram! This Chrome extension flags suspicious images with warning labels as you scroll.

---

## Features

- Real-time AI image detection on Instagram
- Automatic warning labels on suspicious images
- Runs in background while you browse
- Uses Claude AI for accurate detection

---

## How to Install

### Step 1: Clone Repo
```
git clone https://github.com/YOUR_USERNAME/ai-image-detector.git
```

### Step 2: Get API Key
1. Go to: https://console.anthropic.com/account/keys
2. Create new API key
3. Copy it

### Step 3: Add API Key
- Open `background.js`
- Find: `const API_KEY = "YOUR_ANTHROPIC_API_KEY";`
- Replace with your real key

### Step 4: Load in Chrome
1. Open Chrome
2. Go to: `chrome://extensions/`
3. Turn ON "Developer mode" (top right)
4. Click "Load unpacked"
5. Select extension folder
6. Done!

---

## How to Use

1. Go to Instagram.com
2. Scroll your feed
3. AI images get labeled with warning
4. That's it!

---

## Files

| File | Purpose |
|------|---------|
| manifest.json | Chrome configuration |
| content.js | Finds images on Instagram |
| background.js | Checks with Claude API |
| popup.html | Settings window |
| popup.js | Window functionality |

---

## Requirements

- Chrome browser
- Anthropic API key
- Internet connection

---

## How It Works

1. Scans Instagram for images
2. Sends to Claude AI
3. Claude detects if AI-made
4. Labels suspicious images

---

## Notes

- Web version of Instagram only
- API usage has costs
- Check console (F12) for errors

---

## License

MIT
