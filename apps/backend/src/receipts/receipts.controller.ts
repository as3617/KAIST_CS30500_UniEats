import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ok } from "../common/api-response";
import { ConfirmReceiptBody, ReceiptsService } from "./receipts.service";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("image"))
  async upload(
    @Headers("authorization") authorization: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @UploadedFile() file?: any,
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
  async confirm(
    @Param("receiptId") receiptId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ConfirmReceiptBody,
  ) {
    return ok(
      await this.receiptsService.confirm(receiptId, authorization, body),
      "Receipt confirmed",
    );
  }
}
