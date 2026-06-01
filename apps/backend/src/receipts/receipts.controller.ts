import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ok } from "../common/api-response";
import {
  ReceiptConfirmBody,
  ReceiptUploadFile,
  ReceiptsService,
} from "./receipts.service";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @Headers("authorization") authorization: string | undefined,
    @UploadedFile() file: ReceiptUploadFile | undefined,
  ) {
    return ok(await this.receiptsService.upload(authorization, file), "Receipt uploaded");
  }

  @Get(":receiptId")
  async findById(
    @Param("receiptId") receiptId: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return ok(await this.receiptsService.findById(receiptId, authorization));
  }

  @Post(":receiptId/confirm")
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param("receiptId") receiptId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ReceiptConfirmBody,
  ) {
    return ok(
      await this.receiptsService.confirm(receiptId, authorization, body),
      "Receipt confirmed",
    );
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: any) {
    const { receiptId, rawText, error } = body;
    if (!receiptId) {
       return { success: false, error: 'receiptId is required' };
    }
    await this.receiptsService.handleWebhook(receiptId, rawText, error);
    return ok({}, "Webhook processed successfully");
  }
}
