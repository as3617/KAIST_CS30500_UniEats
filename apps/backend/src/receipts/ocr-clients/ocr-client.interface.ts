import { ReceiptUploadFile } from "../receipts.service";

export const OCR_CLIENT = Symbol("OCR_CLIENT");

export interface OcrClient {
  processReceiptAsync(receiptId: string, file: ReceiptUploadFile): Promise<void>;
}
