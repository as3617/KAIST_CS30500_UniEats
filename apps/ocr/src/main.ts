import express from 'express';
import multer from 'multer';
import tesseract from 'node-tesseract-ocr';
import axios from 'axios';
import sharp from 'sharp';

const app = express();
const port = process.env.PORT || 5000;

// Multer config for receiving multipart/form-data
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());

// Main webhook-based endpoint
app.post('/process', upload.single('image'), async (req, res) => {
  try {
    const { receiptId, webhookUrl } = req.body;
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
        const processedImageBuffer = await sharp(file.buffer)
          .resize({ width: Math.round((await sharp(file.buffer).metadata()).width! * 2) })
          .greyscale()
          .normalize()
          .toBuffer();

        const text = await tesseract.recognize(processedImageBuffer, {
          lang: 'kor+eng', // Add English to significantly improve Number/Date parsing
          oem: 1,
          psm: 4, // Assume a single column of text of variable sizes (Best for receipts)
        });

        console.log(`Finished OCR for receiptId: ${receiptId}. Sending to webhook...`);
        
        // Post the result back to the backend
        await axios.post(webhookUrl, {
          receiptId,
          rawText: text,
        });
        
        console.log(`Webhook sent successfully for receiptId: ${receiptId}`);
      } catch (err: any) {
        console.error(`OCR processing failed for receiptId ${receiptId}:`, err);
        // Inform the backend of the failure
        try {
          await axios.post(webhookUrl, {
            receiptId,
            error: err.message || 'OCR processing failed',
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
