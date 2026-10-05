import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';
import { GoogleGenAI } from '@google/genai';

const execAsync = promisify(exec);

// Disable TLS reject unauthorized to allow proxying HTTPS targets with internal or self-signed certs (e.g. government/municipal GIS servers)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'db.json');

// Global CORS Middleware (Handles cross-origin requests and preflight OPTIONS requests)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-KEY, X-User-Custom-AI-Key, x-user-custom-ai-key, *');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Ensure database file exists with initial credit balance of 10
interface UserProfile {
  id: string;
  name: string;
  email: string;
  ai_render_credits: number;
}

const DEVELOPER_EMAILS = ["wdimaculangan@gmail.com"];

const DEFAULT_PROFILE: UserProfile = {
  id: 'default-user',
  name: 'Wendell Dimaculangan',
  email: 'wdimaculangan@gmail.com',
  ai_render_credits: 10,
};

function getProfile(): UserProfile {
  let profile: UserProfile;
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      profile = JSON.parse(data);
    } else {
      profile = { ...DEFAULT_PROFILE };
      saveProfile(profile);
    }
  } catch (e) {
    console.error('Error reading database:', e);
    profile = { ...DEFAULT_PROFILE };
  }
  if (profile.email && DEVELOPER_EMAILS.includes(profile.email)) {
    profile.ai_render_credits = 99999;
  }
  return profile;
}

function saveProfile(profile: UserProfile) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing database:', e);
  }
}

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// API: Get user credits
app.get('/api/user/credits', (req, res) => {
  const profile = getProfile();
  res.json({
    success: true,
    credits: profile.ai_render_credits,
    profile
  });
});

// API: Reset or add credits (useful for testing)
app.post('/api/user/reset', (req, res) => {
  const profile = getProfile();
  profile.ai_render_credits = 10;
  saveProfile(profile);
  res.json({
    success: true,
    credits: profile.ai_render_credits
  });
});

// API: Get POI/Landmark rich details from Gemini or high-fidelity fallback simulation
app.post('/api/poi-details', async (req, res) => {
  const { name, lat, lon, tags } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: "Missing landmark name" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let description = "";
  let funFacts: string[] = [];
  let citations: { title: string; url: string }[] = [];
  let gallery: string[] = [];

  // Generate high-quality gallery images using Unsplash Source with specific landmark keywords
  const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const searchTerms = [
    `architecture,${cleanName}`,
    `landmark,${cleanName}`,
    `history,${cleanName}`
  ];
  gallery = [
    `https://images.unsplash.com/featured/800x600/?${encodeURIComponent(searchTerms[0])}&sig=${Math.floor(Math.random() * 100000)}`,
    `https://images.unsplash.com/featured/800x600/?${encodeURIComponent(searchTerms[1])}&sig=${Math.floor(Math.random() * 100001)}`,
    `https://images.unsplash.com/featured/800x600/?${encodeURIComponent(searchTerms[2])}&sig=${Math.floor(Math.random() * 100002)}`
  ];

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Generate a historical, architectural, and educational profile for the following landmark:
Name: ${name}
Latitude: ${lat}
Longitude: ${lon}
Additional OSM tags: ${JSON.stringify(tags || {})}

Return a JSON object conforming exactly to this schema:
{
  "description": "2-3 paragraphs describing the history, architectural style, cultural impact, and unique characteristics of this landmark.",
  "funFacts": ["Fact 1", "Fact 2", "Fact 3"],
  "citations": [{"title": "Source name", "url": "Reference URL or Wikipedia/OSM link"}]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        description = parsed.description || "";
        funFacts = parsed.funFacts || [];
        citations = parsed.citations || [];
      }
    } catch (err) {
      console.error("Gemini failed for poi-details, falling back:", err);
    }
  }

  // Fallback to high-fidelity simulated content if Gemini failed or wasn't configured
  if (!description) {
    const tourismType = tags?.tourism || tags?.historical || "landmark";
    description = `The ${name} is a renowned local ${tourismType} located at coordinates ${lat.toFixed(4)}°, ${lon.toFixed(4)}°. It represents a key point of interest, attracting visitors and historical interest alike. Its surroundings highlight the intersection of heritage, geography, and urban design.`;
    funFacts = [
      `Located precisely at ${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E.`,
      `Classified as a tourism attraction / historical monument under OpenStreetMap's local tag classification.`,
      `Situated within a 5000-meter radius of the current interactive viewport center.`
    ];
    citations = [
      { title: "OpenStreetMap Data", url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}` },
      { title: "Wikipedia Search", url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}` }
    ];
  }

  return res.json({
    success: true,
    description,
    funFacts,
    citations,
    gallery
  });
});

// API: EPSG.io Projection Proxy (bypasses CORS and client-side sandbox limitations)
app.get('/api/projection/epsg/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const fetchResponse = await fetch(`https://epsg.io/${code}.proj4`);
    if (fetchResponse.ok) {
      const text = await fetchResponse.text();
      return res.json({ success: true, proj4: text.trim() });
    }
    return res.status(fetchResponse.status).json({ success: false, error: `EPSG.io returned status ${fetchResponse.status}` });
  } catch (err: any) {
    console.error(`Error proxying EPSG:${code}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: General CORS URL Proxy (bypasses CORS constraints for tilesets, ArcGIS, I3S layers, etc.)
app.get('/api/proxy', async (req, res) => {
  let targetUrl = req.query.url as string;
  const originalUrl = req.originalUrl;
  const urlParamIndex = originalUrl.indexOf('url=');
  if (urlParamIndex !== -1) {
    const rawTarget = originalUrl.substring(urlParamIndex + 4);
    try {
      targetUrl = decodeURIComponent(rawTarget);
    } catch (e) {
      targetUrl = rawTarget;
    }
  }

  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

  targetUrl = targetUrl.trim();
  if (targetUrl.startsWith('//')) {
    targetUrl = 'https:' + targetUrl;
  }

  // Handle double-encoded URLs
  if (targetUrl.includes('%3A') || targetUrl.includes('%2F')) {
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {}
  }

  // Early migration: internal IP or internal/legacy DMT domains -> public geosmart.dmt.gov.ae
  if (/(?:https?:\/\/)?(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/(?:https?:\/\/)?(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)(?::\d+)?/gi, 'https://geosmart.dmt.gov.ae');
  }
  if (/uds_uppc\.dmt\.gov\.ae/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/uds_uppc\.dmt\.gov\.ae/gi, 'geosmart.dmt.gov.ae');
  }
  if (/uds-uppc\.dmt\.gov\.ae/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/uds-uppc\.dmt\.gov\.ae/gi, 'geosmart.dmt.gov.ae');
  }
  if (/geoportal\.dmt\.gov\.ae/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/geoportal\.dmt\.gov\.ae/gi, 'geosmart.dmt.gov.ae');
  }
  if (/uppc\.dmt\.gov\.ae/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/uppc\.dmt\.gov\.ae/gi, 'geosmart.dmt.gov.ae');
  }

  // Handle UrbanPlanningGeosphere portal path -> UDM services folder
  if (/urbanplanninggeosphere/i.test(targetUrl)) {
    targetUrl = targetUrl.replace(/\/UrbanPlanningGeosphere(?:\/(?:ImageServer|MapServer|arcgis\/rest\/services))?/i, '/arcgis/rest/services/UDM');
  }

  try {
    let parsedTarget = new URL(targetUrl);
    
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-api-key']) {
      headers['X-API-KEY'] = req.headers['x-api-key'] as string;
    }

    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(targetUrl, { headers });
    } catch (netErr: any) {
      // Auto-fallback: If geoportal.dmt.gov.ae fails to resolve, retry with public geosmart.dmt.gov.ae
      if (targetUrl.includes('geoportal.dmt.gov.ae')) {
        const fallbackUrl = targetUrl.replace('geoportal.dmt.gov.ae', 'geosmart.dmt.gov.ae');
        console.log(`[Proxy] geoportal.dmt.gov.ae unreachable, attempting public geosmart fallback: ${fallbackUrl}`);
        fetchResponse = await fetch(fallbackUrl, { headers });
      } else {
        throw netErr;
      }
    }

    const contentType = fetchResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(fetchResponse.status).send(buffer);
  } catch (err: any) {
    const isNetworkUnreachable =
      err?.code === 'EHOSTUNREACH' ||
      err?.code === 'ENOTFOUND' ||
      err?.code === 'ECONNREFUSED' ||
      err?.message?.includes('EHOSTUNREACH') ||
      err?.message?.includes('ENOTFOUND') ||
      err?.message?.includes('fetch failed');

    if (isNetworkUnreachable) {
      console.warn(`[Proxy] Target URL ${targetUrl} is unreachable from cloud server: ${err?.message || err?.code}`);
      return res.status(502).json({
        success: false,
        error: `The server or intranet domain could not be reached from cloud server proxy (${err?.message || 'Network unreachable'}). If accessing an internal enterprise VPN or intranet, please enable Direct Browser Connection Mode with your CORS extension active.`
      });
    }
    console.error(`[Proxy] Error fetching target ${targetUrl}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/proxy', async (req, res) => {
  let targetUrl = req.query.url as string;
  const originalUrl = req.originalUrl;
  const urlParamIndex = originalUrl.indexOf('url=');
  if (urlParamIndex !== -1) {
    const rawTarget = originalUrl.substring(urlParamIndex + 4);
    try {
      targetUrl = decodeURIComponent(rawTarget);
    } catch (e) {
      targetUrl = rawTarget;
    }
  }

  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'url parameter is required' });
  }

  targetUrl = targetUrl.trim();
  if (targetUrl.startsWith('//')) {
    targetUrl = 'https:' + targetUrl;
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-api-key']) {
      headers['X-API-KEY'] = req.headers['x-api-key'] as string;
    }

    let body: any = undefined;
    const reqContentType = req.headers['content-type'] || '';
    if (reqContentType.includes('application/x-www-form-urlencoded')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const formParams = new URLSearchParams();
      for (const [key, val] of Object.entries(req.body)) {
        formParams.append(key, String(val));
      }
      body = formParams.toString();
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }

    const fetchResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body
    });

    const contentType = fetchResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(fetchResponse.status).send(buffer);
  } catch (err: any) {
    console.error(`[Proxy POST] Error fetching target ${targetUrl}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Image Generation Gateway
app.post('/api/render/img2img', async (req, res) => {
  let { prompt, resolution, imageRef, model, input, output_width } = req.body;

  // Extract from input array if present (standard Nano Banana API model format)
  if (input && Array.isArray(input)) {
    const textItem = input.find((item: any) => item.type === 'text');
    if (textItem && textItem.text) {
      prompt = textItem.text;
    }
    const imageItem = input.find((item: any) => item.type === 'image');
    if (imageItem && imageItem.data && imageItem.mime_type) {
      imageRef = `data:${imageItem.mime_type};base64,${imageItem.data}`;
    }
  }

  // Map model if specific internal names are used
  let officialModelID = model || 'nano banana pro';
  if (officialModelID === 'nano banana pro' || officialModelID === 'gemini-3.1-pro-image-preview' || officialModelID === 'gemini-3.1-pro-image' || officialModelID === 'gemini-3-pro-image') {
    officialModelID = 'gemini-3-pro-image';
  } else if (officialModelID === 'nano banana lite' || officialModelID === 'gemini-3.1-flash-lite' || officialModelID === 'gemini-3.1-flash-lite-image') {
    officialModelID = 'gemini-3.1-flash-lite-image';
  } else if (officialModelID === 'nano banana 2' || officialModelID === 'gemini-3.1-flash-image') {
    officialModelID = 'gemini-3.1-flash-image';
  }

  // Map output_width to resolution
  if (output_width) {
    if (output_width === 2560) {
      resolution = '2K';
    } else if (output_width === 3840) {
      resolution = '4K';
    } else {
      resolution = '1K';
    }
  }

  const userKeyHeader = req.headers['x-user-custom-ai-key'] as string | undefined;

  const hasImageRef = imageRef && imageRef.trim() !== '';
  console.log(`[API Gateway] Received img2img request. Model: "${officialModelID}", Prompt: "${prompt}", Resolution: ${resolution}, ImageRef length: ${hasImageRef ? imageRef.length : 0}`);

  let isBypassed = false;
  let usedKey = 'None';

  // 1. Check A: User Custom Key Fallback
  if (userKeyHeader && userKeyHeader.trim() !== '' && userKeyHeader !== 'null' && userKeyHeader !== 'undefined') {
    isBypassed = true;
    usedKey = userKeyHeader.trim();
    console.log('[API Gateway] Check A Passed: Custom user developer key detected. Bypassing master credit verification.');
  } else {
    // 2. Check B: Master Key Protocol
    console.log('[API Gateway] Check A Declined: No custom key header. Initiating Master Key verification.');
    
    // Check master env key (warn if not set, but fall back to a default token)
    const masterKey = process.env.GEMINI_API_KEY || process.env.NANO_BANANA_API_KEY || 'NANO_BANANA_DEFAULT_MASTER_KEY_2026';
    usedKey = masterKey;

    // Fetch and verify user's relational credit profile
    const profile = getProfile();
    
    // Evaluate resolution cost multiplier
    // 1K costs 1 credit, 2K costs 2 credits, 4K costs 4 credits
    let cost = 1;
    if (resolution === '2K') cost = 2;
    if (resolution === '4K') cost = 4;

    if (profile.ai_render_credits < cost) {
      console.log(`[API Gateway] Check B Failed: Credit exhaustion. Required ${cost}, available ${profile.ai_render_credits}.`);
      return res.status(403).json({
        success: false,
        error: `Credit threshold reached. Credit exhaustion. Required ${cost} credits, you only have ${profile.ai_render_credits} remaining.`
      });
    }

    // Deduct credits
    profile.ai_render_credits -= cost;
    saveProfile(profile);
    console.log(`[API Gateway] Check B Passed: Deducted ${cost} credits. Remaining: ${profile.ai_render_credits}.`);
    
    // Set response header
    res.setHeader('X-Credits-Remaining', profile.ai_render_credits.toString());
  }

  // Build the parts list precisely matching Google's multi-modal contents structure
  const parts: any[] = [];
  if (input && Array.isArray(input)) {
    for (const item of input) {
      if (item.type === 'text') {
        parts.push({ text: item.text });
      } else if (item.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: item.mime_type || 'image/png',
            data: item.data
          }
        });
      }
    }
  } else {
    parts.push({ text: prompt });
    if (hasImageRef) {
      const base64Data = imageRef.includes(';base64,') ? imageRef.split(';base64,')[1] : imageRef;
      const mimeTypeMatch = imageRef.match(/data:([^;]+);base64,/);
      const matchedMime = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
      parts.push({
        inlineData: {
          mimeType: matchedMime,
          data: base64Data
        }
      });
    }
  }

  // Build generationConfig matching the visual modality parameters requested by user
  const generationConfig: any = {
    responseModalities: ["IMAGE"]
  };

  let targetWidthNum = 1920;
  let targetHeightNum = 1080;
  if (resolution === '2K') {
    targetWidthNum = 2560;
    targetHeightNum = 1440;
  } else if (resolution === '4K') {
    targetWidthNum = 3840;
    targetHeightNum = 2160;
  }

  generationConfig.custom_dimensions = {
    width: targetWidthNum,
    height: targetHeightNum
  };

  // Curate fallback simulated image in case real rendering fails or key is missing
  const images = [
    {
      keywords: ['abu dhabi', 'dubai', 'uae', 'emirates', 'coast', 'water'],
      url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
      desc: 'Abu Dhabi futuristic coastal skyline rendering'
    },
    {
      keywords: ['sustainable', 'green', 'park', 'garden', 'nature', 'eco'],
      url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
      desc: 'Sustainable green city rooftop forest rendering'
    },
    {
      keywords: ['skyscraper', 'highrise', 'tower', 'glass', 'modern', 'nyc', 'manhattan'],
      url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
      desc: 'Futuristic glass architectural skyscraper'
    },
    {
      keywords: ['sunset', 'dusk', 'warm', 'orange', 'light'],
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      desc: 'Glass pavilion render during contemporary sunset'
    },
    {
      keywords: ['concept', 'brutalist', 'avant-garde', 'futuristic'],
      url: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=1200&q=80',
      desc: 'Avant-garde dynamic architectural structural span'
    }
  ];

  const lowerPrompt = (prompt || '').toLowerCase();
  let matchedImage = images[images.length - 1];
  for (const item of images) {
    if (item.keywords.some(kw => lowerPrompt.includes(kw))) {
      matchedImage = item;
      break;
    }
  }

  let finalImageUrl = '';
  let renderSucceeded = false;
  let lastErrorMsg = '';
  let usedModelName = officialModelID;

  // Let's call the real Google Generative Language API via @google/genai SDK
  const finalKey = usedKey;
  if (finalKey && finalKey !== 'NANO_BANANA_DEFAULT_MASTER_KEY_2026' && finalKey !== 'None') {
    const candidateModels: string[] = [];
    if (officialModelID === 'gemini-3-pro-image') {
      candidateModels.push('gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image');
    } else if (officialModelID === 'gemini-3.1-flash-image') {
      candidateModels.push('gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image');
    } else {
      candidateModels.push('gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image');
    }

    try {
      console.log(`[API Gateway] Initializing GoogleGenAI SDK for image-to-image render. Candidate models:`, candidateModels);
      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      let ratio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9";
      if (resolution === 'Square' || resolution === '1:1') {
        ratio = "1:1";
      }

      for (const modelToTry of candidateModels) {
        try {
          console.log(`[API Gateway] Attempting real AI render via Google GenAI SDK with model "${modelToTry}"`);
          const config: any = {
            imageConfig: {
              aspectRatio: ratio
            }
          };

          if (modelToTry !== 'gemini-3.1-flash-lite-image') {
            let size = '1K';
            if (resolution === '2K') size = '2K';
            else if (resolution === '4K') size = '4K';
            config.imageConfig.imageSize = size;
          }

          const response = await ai.models.generateContent({
            model: modelToTry,
            contents: {
              parts: parts
            },
            config: config
          });

          if (response && response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData && part.inlineData.data) {
                const outputBase64 = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                finalImageUrl = `data:${mimeType};base64,${outputBase64}`;
                renderSucceeded = true;
                usedModelName = modelToTry;
                console.log(`[API Gateway] Success: Real AI rendering retrieved via Google GenAI SDK (${modelToTry})! Size: ${finalImageUrl.length} bytes.`);
                break;
              }
            }
          }
          if (renderSucceeded) break;
        } catch (err: any) {
          lastErrorMsg = err?.message || String(err);
          console.error(`[API Gateway] Google GenAI SDK model "${modelToTry}" failed:`, lastErrorMsg);
        }
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || String(err);
      console.error(`[API Gateway] Google GenAI SDK initialization error:`, lastErrorMsg);
    }
  } else {
    lastErrorMsg = 'No Gemini API Key found. Please configure your API Key in Settings or the AI Render Key Panel.';
  }

  if (!renderSucceeded) {
    console.error(`[API Gateway] Image render failed. Error: ${lastErrorMsg}`);
    return res.status(400).json({
      success: false,
      error: lastErrorMsg || 'Failed to render image with Gemini API key. Please check your API key and permissions.'
    });
  }

  const finalDescription = `Photorealistic ${resolution} AI Architectural Render (${usedModelName})`;
  const profile = getProfile();
  return res.json({
    success: true,
    imageUrl: finalImageUrl,
    description: finalDescription,
    prompt: prompt,
    resolution: resolution,
    model: usedModelName,
    creditsRemaining: profile.ai_render_credits,
    isBypassed: isBypassed,
    gatewayLog: `Processed via ${isBypassed ? 'Custom User API Key' : 'GEMINI_API_KEY'} using ${usedModelName} (Real AI Render).`
  });
});

// API: Export IIS Web Package (.zip) with automated npm run build and generated web.config
const handleExportIIS = async (req: express.Request, res: express.Response) => {
  try {
    console.log('[IIS Export] Executing production build (npm run build)...');

    // 1. Run production build command via child_process
    try {
      await execAsync('npm run build', { maxBuffer: 15 * 1024 * 1024, timeout: 120000 });
      console.log('[IIS Export] Production build finished.');
    } catch (buildErr: any) {
      console.warn('[IIS Export] Build command message:', buildErr.message);
      // Ensure dist exists before aborting
      const distCheck = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distCheck)) {
        return res.status(500).json({ success: false, error: `Build failed: ${buildErr.message}` });
      }
    }

    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      return res.status(500).json({ success: false, error: 'dist directory does not exist.' });
    }

    // 2. Generate production-ready web.config inside dist/
    const webConfigContent = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".gltf" /><mimeMap fileExtension=".gltf" mimeType="model/gltf+json" />
      <remove fileExtension=".glb" /><mimeMap fileExtension=".glb" mimeType="model/gltf-binary" />
      <remove fileExtension=".b3dm" /><mimeMap fileExtension=".b3dm" mimeType="application/octet-stream" />
      <remove fileExtension=".i3dm" /><mimeMap fileExtension=".i3dm" mimeType="application/octet-stream" />
      <remove fileExtension=".pnts" /><mimeMap fileExtension=".pnts" mimeType="application/octet-stream" />
      <remove fileExtension=".cmpt" /><mimeMap fileExtension=".cmpt" mimeType="application/octet-stream" />
      <remove fileExtension=".terrain" /><mimeMap fileExtension=".terrain" mimeType="application/octet-stream" />
      <remove fileExtension=".wasm" /><mimeMap fileExtension=".wasm" mimeType="application/wasm" />
      <remove fileExtension=".json" /><mimeMap fileExtension=".json" mimeType="application/json" />
      <remove fileExtension=".geojson" /><mimeMap fileExtension=".geojson" mimeType="application/geo+json" />
    </staticContent>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="1073741824" />
      </requestFiltering>
    </security>
    <rewrite>
      <rules>
        <rule name="React SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.html" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="Access-Control-Allow-Origin" value="*" />
        <add name="Access-Control-Allow-Headers" value="Content-Type, Authorization, X-User-Custom-AI-Key" />
        <add name="Access-Control-Allow-Methods" value="GET, POST, OPTIONS" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>`;

    fs.writeFileSync(path.join(distPath, 'web.config'), webConfigContent, 'utf-8');
    console.log('[IIS Export] Generated web.config inside dist/.');

    // 3. Zip dist directory using JSZip
    const zip = new JSZip();

    async function addDirToZip(currentDir: string, baseDir: string) {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (item.isDirectory()) {
          await addDirToZip(fullPath, baseDir);
        } else {
          const content = fs.readFileSync(fullPath);
          zip.file(relPath, content);
        }
      }
    }

    await addDirToZip(distPath, distPath);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`[IIS Export] Created ZIP package (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB). Sending file...`);

    // 4. Stream / Send zip package
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="Geosphere_3D_IIS_Package.zip"');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    return res.send(zipBuffer);

  } catch (err: any) {
    console.error('[IIS Export] Export failed:', err);
    return res.status(500).json({ success: false, error: err.message || 'IIS Web Package Export failed.' });
  }
};

app.get('/api/export-iis', handleExportIIS);
app.post('/api/export-iis', handleExportIIS);

async function startServer() {
  // Vite dev middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Fullstack Gateway] Server running on http://localhost:${PORT}`);
  });
}

startServer();
