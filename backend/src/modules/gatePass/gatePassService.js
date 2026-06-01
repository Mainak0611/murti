// backend/src/modules/gatePass/gatePassService.js
// Gemini gate pass extraction with sharp compression and API key rotation

import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import fs from 'fs/promises';

const EXTRACTION_PROMPT = `This is a handwritten gate pass image.
Extract ONLY the items list from this gate pass.
Return ONLY valid JSON, no markdown, no explanation, no code fences:
{
  items: [
    { item: "C-CHENAL", size: "6M", qty: 104 }
  ]
}
Rules:
- item: extract the EXACT item name as written on the gate pass.
  Do NOT rename or normalize to any standard vocabulary.
  Read what is actually written and return that.
- size: extract size like 6M, 500MM, 2M etc. exactly as written.
  If no size mentioned use null.
- qty: extract the number only (e.g. 104, not '104 NOS')
- If quantity is unreadable use null
- Do not include any other fields`;

/**
 * Compresses the image using sharp before sending to API.
 * Resizes to max 1000px width, converts to JPEG quality 65.
 *
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<Buffer>} - Compressed JPEG buffer
 */
const compressImage = async (imageBuffer) => {
  const compressed = await sharp(imageBuffer)
    .resize({ width: 1000, withoutEnlargement: true })
    .jpeg({ quality: 65 })
    .toBuffer();

  console.log(`🗜️  Image compressed: ${(imageBuffer.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB`);
  return compressed;
};

/**
 * Calls Gemini API with key rotation logic.
 *
 * @param {string} base64Image - Base64 encoded JPEG image
 * @returns {Promise<string>} - Raw text response from the model
 */
const callGeminiWithRotation = async (base64Image) => {
  const API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].map(k => (k || '').trim()).filter(Boolean);

  if (API_KEYS.length === 0) {
    throw new Error('No valid Gemini API keys found in environment variables (GEMINI_API_KEY_1 to 4)');
  }

  let keyIndex = 0;
  let attemptFor503 = 0;
  const max503Retries = 3;

  while (keyIndex < API_KEYS.length) {
    const currentKey = API_KEYS[keyIndex];
    try {
      console.log(`🤖 Attempting extraction with Gemini Key ${keyIndex + 1}...`);

      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        },
        EXTRACTION_PROMPT
      ]);
      const text = result.response.text();
      return text;

    } catch (err) {
      const errMsg = err.message || '';
      const status = err.status || err.statusCode;

      // Determine if error is 429 (quota exceeded) or 503 (overloaded)
      const is429 = status === 429 || errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('exhausted');
      const is503 = status === 503 || errMsg.includes('503') || errMsg.toLowerCase().includes('overloaded') || errMsg.toLowerCase().includes('service unavailable');

      if (is429) {
        console.warn(`Key ${keyIndex + 1} exhausted, switching to key ${keyIndex + 2}...`);
        keyIndex++;
        attemptFor503 = 0; // reset retry counter for the new key
        continue;
      }

      if (is503) {
        attemptFor503++;
        if (attemptFor503 <= max503Retries) {
          console.warn(`⚠️  Gemini API overloaded (503) on Key ${keyIndex + 1}. Waiting 5 seconds before retry ${attemptFor503}/${max503Retries}...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue; // retry same key
        } else {
          console.warn(`⚠️  Gemini API 503 retries exhausted on Key ${keyIndex + 1}. Switching to next key...`);
          keyIndex++;
          attemptFor503 = 0;
          continue;
        }
      }

      // Any other error (invalid key, format error, etc.) counts as key failure
      console.warn(`⚠️  Gemini API error on Key ${keyIndex + 1}: ${err.message}. Switching to next key...`);
      keyIndex++;
      attemptFor503 = 0;
    }
  }

  throw new Error('All API keys exhausted for today');
};

/**
 * POST /api/gate-pass/extract
 *
 * Accepts a gate pass image and module type, compresses it with sharp,
 * sends it to Gemini, and returns structured extracted data.
 *
 * Request: multipart/form-data
 *   - image: File (JPEG/PNG)
 *   - moduleType: "RETURN" | "DISPATCH"
 *
 * Response: {
 *   success: boolean,
 *   gate_pass_no, date, time, name, site,
 *   moduleType,
 *   items: [{ item, size, qty }],
 *   total_qty, vehicle_no, receiver_name, receiver_mobile,
 *   rawResponse: string
 * }
 */
export const extractGatePass = async (req, res) => {
  const startTime = Date.now();

  try {
    // ── Step 0: Validate Input ──────────────────────────────
    const file = req.file;
    const moduleType = (req.body.moduleType || '').toUpperCase();

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded. Please upload a gate pass photo.',
      });
    }

    if (!['RETURN', 'DISPATCH'].includes(moduleType)) {
      await cleanupFile(file.path);
      return res.status(400).json({
        success: false,
        error: 'Invalid moduleType. Must be "RETURN" or "DISPATCH".',
      });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      await cleanupFile(file.path);
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Gate Pass Extraction Started (Gemini 2.0 Flash)`);
    console.log(`   Module: ${moduleType}`);
    console.log(`   File: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB)`);
    console.log(`${'='.repeat(60)}`);

    // ── Step 1: Read and compress image ─────────────────────
    const rawBuffer = await fs.readFile(file.path);

    console.log('\n🗜️  Compressing image with sharp...');
    const compressedBuffer = await compressImage(rawBuffer);
    const base64Image = compressedBuffer.toString('base64');

    // ── Step 2: Call Gemini API ─────────────────────────
    console.log('\n🤖 Sending image to Gemini...');
    const rawText = await callGeminiWithRotation(base64Image);

    console.log('\n📝 Raw Gemini response:');
    console.log(rawText.substring(0, 800));

    // ── Step 3: Parse JSON from response ────────────────────
    let parsed;
    try {
      // Strip any markdown code fences if the model adds them
      let jsonStr = rawText.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('❌ Failed to parse JSON response:', parseErr.message);
      console.error('Raw text was:', rawText);
      await cleanupFile(file.path);
      return res.status(422).json({
        success: false,
        error: 'AI returned an invalid response. Please try again with a clearer image.',
        rawResponse: rawText,
      });
    }

    // ── Step 4: Normalize & validate parsed data ────────────
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item, idx) => ({
        item: item.item || item.name || `Unknown Item ${idx + 1}`,
        size: item.size || null,
        qty: typeof item.qty === 'number' ? item.qty : (parseInt(item.qty) || 0),
      }))
      : [];

    // ── Step 5: Cleanup & Respond ───────────────────────────
    await cleanupFile(file.path);

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Extraction completed in ${elapsed}ms`);
    console.log(`   Items found: ${items.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return res.status(200).json({
      success: true,
      gate_pass_no: parsed.gate_pass_no || null,
      date: parsed.date || null,
      time: parsed.time || null,
      name: parsed.name || null,
      site: parsed.site || null,
      moduleType,
      items,
      total_qty: parsed.total_qty || null,
      vehicle_no: parsed.vehicle_no || null,
      receiver_name: parsed.receiver_name || null,
      receiver_mobile: parsed.receiver_mobile || null,
      rawResponse: rawText,
    });

  } catch (err) {
    console.error('❌ Gate pass extraction failed:', err);

    // Attempt to clean up file on error
    if (req.file?.path) {
      await cleanupFile(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: 'Gate pass extraction failed. Please try again with a clearer image.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Safely delete an uploaded temp file.
 * @param {string} filePath
 */
const cleanupFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (e) {
    // Ignore cleanup errors (file may already be deleted)
  }
};
