import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { CafeteriaManagersModule } from "./cafeteria-managers/cafeteria-managers.module";
import { CafeteriasModule } from "./cafeterias/cafeterias.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { HealthModule } from "./health/health.module";
import { MealsModule } from "./meals/meals.module";
import { MenuServingsModule } from "./menu-servings/menu-servings.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { UsersModule } from "./users/users.module";
import { ViewHistoriesModule } from "./view-histories/view-histories.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>("MONGODB_URI", "mongodb://localhost:27017/unieats"),
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    CafeteriasModule,
    MealsModule,
    MenuServingsModule,
    ReceiptsModule,
    ReviewsModule,
    FavoritesModule,
    ViewHistoriesModule,
    CafeteriaManagersModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
