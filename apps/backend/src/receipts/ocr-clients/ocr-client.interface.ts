import { ReceiptUploadFile } from "../receipts.service";
import { OcrProvider } from "../../common/enums";

export const OCR_CLIENT = Symbol("OCR_CLIENT");

export interface OcrClient {
  provider: OcrProvider;
  processReceiptAsync(receiptId: string, file: ReceiptUploadFile): Promise<void>;
}
