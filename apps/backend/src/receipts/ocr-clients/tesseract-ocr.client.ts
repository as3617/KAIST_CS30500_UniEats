import { Injectable } from "@nestjs/common";
import axios from "axios";
import FormData from "form-data";
import { OcrClient } from "./ocr-client.interface";
import { ReceiptUploadFile } from "../receipts.service";

@Injectable()
export class TesseractOcrClient implements OcrClient {
  async processReceiptAsync(receiptId: string, file: ReceiptUploadFile): Promise<void> {
    const formData = new FormData();
    formData.append("receiptId", receiptId);
    
    // Internal network URL for the webhook
    const webhookUrl = process.env.OCR_WEBHOOK_URL || "http://backend:4000/api/receipts/webhook";
    formData.append("webhookUrl", webhookUrl);
    
    formData.append("image", file.buffer!, file.originalname || "receipt.jpg");

    const ocrServiceUrl = process.env.OCR_SERVICE_URL || "http://ocr:5000/process";

    await axios.post(ocrServiceUrl, formData, {
      headers: formData.getHeaders(),
    });
  }
}
