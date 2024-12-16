import { Body, Controller, Get, Param, Patch, ValidationPipe } from '@nestjs/common';
import { PointService } from './point.service';
import { UserPoint, PointHistory } from './point.model';
import { PointBody as PointDto } from './point.dto';

@Controller('/point')
export class PointController {
    constructor(
        private readonly pointService: PointService
    ) {}

    // 특정 유저의 포인트 조회
    @Get(':id')
    async point(@Param('id') id: string): Promise<UserPoint> {
        const userId = Number.parseInt(id);
        return this.pointService.getUserPoint(userId);
    }

    // 특정 유저의 포인트 충전/이용 내역 조회
    @Get(':id/histories')
    async history(@Param('id') id: string): Promise<PointHistory[]> {
        const userId = Number.parseInt(id);
        return this.pointService.getPointHistories(userId);
    }

    // 특정 유저의 포인트 충전
    @Patch(':id/charge')
    async charge(
        @Param('id') id: string,
        @Body(ValidationPipe) pointDto: PointDto,
    ): Promise<UserPoint> {
        const userId = Number.parseInt(id);
        const {amount} = pointDto;
        return this.pointService.chargePoint(userId, amount);
    }

    // 특정 유저의 포인트 사용
    @Patch(':id/use')
    async use(
        @Param('id') id: string,
        @Body(ValidationPipe) pointDto: PointDto,
    ): Promise<UserPoint> {
        const userId = Number.parseInt(id);
        const {amount} = pointDto;
        return this.pointService.usePoint(userId, amount);
    }
}
