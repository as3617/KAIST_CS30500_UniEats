import { Injectable, NotImplementedException } from "@nestjs/common";
import { OcrClient } from "./ocr-client.interface";
import { ReceiptUploadFile } from "../receipts.service";

@Injectable()
export class NaverClovaOcrClient implements OcrClient {
  async processReceiptAsync(receiptId: string, file: ReceiptUploadFile): Promise<void> {
    // TODO: Implement Naver CLOVA OCR integration
    // 1. Authenticate with Naver Cloud Platform
    // 2. Send file buffer to CLOVA API
    // 3. Parse CLOVA response format
    // 4. Send parsed data to webhook URL
    throw new NotImplementedException("Naver CLOVA OCR integration is not yet implemented.");
  }
}
