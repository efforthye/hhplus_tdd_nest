import { Injectable } from '@nestjs/common';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
    constructor(
        private readonly userDb: UserPointTable,
        private readonly historyDb: PointHistoryTable,
    ) {}

    /**
     * 특정 유저의 포인트 조회
     * @param userId - 조회할 유저의 ID
     * @returns 유저의 포인트 정보
     */
    async getUserPoint(userId: number): Promise<UserPoint> {
        return this.userDb.selectById(userId);
    }

    /**
     * 특정 유저의 포인트 충전/이용 내역 조회
     * @param userId - 조회할 유저의 ID
     * @returns 유저의 포인트 내역 배열
     */
    async getPointHistories(userId: number): Promise<PointHistory[]> {
        return this.historyDb.selectAllByUserId(userId);
    }

    /**
     * 특정 유저의 포인트 충전
     * @param userId - 충전할 유저의 ID
     * @param amount - 충전할 포인트 금액
     * @returns 충전 후 갱신된 유저의 포인트 정보
     */
    async chargePoint(userId: number, amount: number): Promise<UserPoint> {
        const { point: prevAmount } = await this.userDb.selectById(userId);
        const newAmount = prevAmount + amount;

        // 포인트 업데이트 및 히스토리 기록
        return this.updateUserPointAndHistory(userId, newAmount, TransactionType.CHARGE);
    }

    /**
     * 특정 유저의 포인트 사용
     * @param userId - 사용할 유저의 ID
     * @param amount - 사용할 포인트 금액
     * @returns 사용 후 갱신된 유저의 포인트 정보
     */
    async usePoint(userId: number, amount: number): Promise<UserPoint> {
        const { point: prevAmount } = await this.userDb.selectById(userId);
        const newAmount = prevAmount - amount;

        // 포인트 업데이트 및 히스토리 기록
        return this.updateUserPointAndHistory(userId, newAmount, TransactionType.USE);
    }

    /**
     * 유저 포인트 갱신 및 갱신 내역 히스토리 기록
     * @param userId - 포인트를 갱신할 유저의 ID
     * @param newAmount - 갱신할 새로운 포인트 금액
     * @param transactionType - 트랜잭션 유형 (CHARGE/USE)
     * @returns 갱신된 유저의 포인트 정보
     */
    private async updateUserPointAndHistory(
        userId: number,
        newAmount: number,
        transactionType: TransactionType,
    ): Promise<UserPoint> {
        // 포인트 정보 갱신
        const updatedPointInfo = await this.userDb.insertOrUpdate(userId, newAmount);
        const { updateMillis } = updatedPointInfo;

        // 갱신 내역을 히스토리에 기록
        await this.historyDb.insert(userId, newAmount, transactionType, updateMillis);

        return updatedPointInfo;
    }
}
