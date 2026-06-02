import express from 'express';
import multer from 'multer';
import axios from 'axios';
import sharp from 'sharp';
import { spawn } from 'child_process';

const app = express();
const port = process.env.PORT || 5000;

// Multer config for receiving multipart/form-data
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());

// Main webhook-based endpoint
app.post('/process', upload.single('image'), async (req, res) => {
  try {
    const receiptId = firstString(req.body.receiptId);
    const webhookUrl = firstString(req.body.webhookUrl);
    const webhookSecret = firstString(req.body.webhookSecret);
    const file = req.file;

    if (!receiptId || !webhookUrl || !file) {
      return res.status(400).json({ error: 'Missing receiptId, webhookUrl, or image' });
    }

    // Acknowledge the request immediately
    res.status(202).json({ message: 'OCR processing started' });

    // Process asynchronously
    setImmediate(async () => {
      try {
        console.log(`Starting OCR for receiptId: ${receiptId}`);

        // Image Pre-processing pipeline
        // 1. Resize (2x upscaling) to make small text clearer
        // 2. Grayscale to remove color noise
        // 3. Normalize to maximize contrast
        // Note: Removed hard .threshold(128) because it ruins thin text (like dates) or uneven lighting.
        // Tesseract uses adaptive Otsu thresholding internally which is much better.
        const metadata = await sharp(file.buffer).metadata();
        const resizeWidth = metadata.width ? Math.min(metadata.width * 2, 2400) : undefined;
        const processedImageBuffer = await sharp(file.buffer)
          .resize(resizeWidth ? { width: resizeWidth } : undefined)
          .greyscale()
          .normalize()
          .toBuffer();

        const text = await runTesseract(processedImageBuffer);

        console.log(`Finished OCR for receiptId: ${receiptId}. Sending to webhook...`);

        // Post the result back to the backend
        await axios.post(webhookUrl, {
          receiptId,
          rawText: text,
        }, {
          headers: buildWebhookHeaders(webhookSecret),
        });

        console.log(`Webhook sent successfully for receiptId: ${receiptId}`);
      } catch (err: any) {
        console.error(`OCR processing failed for receiptId ${receiptId}:`, err);
        // Inform the backend of the failure
        try {
          await axios.post(webhookUrl, {
            receiptId,
            error: err.message || 'OCR processing failed',
          }, {
            headers: buildWebhookHeaders(webhookSecret),
          });
        } catch (webhookErr) {
          console.error('Failed to send failure webhook:', webhookErr);
        }
      }
    });

  } catch (err) {
    console.error('Failed to accept OCR request:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`OCR Microservice listening on port ${port}`);
});

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function buildWebhookHeaders(webhookSecret?: string) {
  return webhookSecret ? { 'X-OCR-Webhook-Secret': webhookSecret } : undefined;
}

function runTesseract(image: Buffer) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('tesseract', [
      'stdin',
      'stdout',
      '-l',
      'eng+kor',
      '--oem',
      '1',
      '--psm',
      '4',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString('utf8') || `tesseract exited with ${code}`));
    });

    child.stdin.end(image);
  });
}
