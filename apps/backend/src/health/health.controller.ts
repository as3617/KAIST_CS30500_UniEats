import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "unieats-api",
      timestamp: new Date().toISOString(),
    };
  }
}
