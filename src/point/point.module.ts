import { Module } from "@nestjs/common";
import { PointController } from "./point.controller";
import { DatabaseModule } from "src/database/database.module";
import { PointService } from "./point.service";
import { UserPointTable } from "src/database/userpoint.table";
import { PointHistoryTable } from "src/database/pointhistory.table";
import { PointValidationService } from "./point-validation.service";

@Module({
    imports: [DatabaseModule],
    controllers: [PointController],
    providers: [PointService, UserPointTable, PointHistoryTable, PointValidationService],
    exports: [PointService, PointValidationService]
})
export class PointModule {}