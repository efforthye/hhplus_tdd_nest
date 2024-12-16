import { Injectable } from '@nestjs/common';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { PointValidationService } from './point-validation.service';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
    constructor(
        private readonly userDb: UserPointTable,
        private readonly historyDb: PointHistoryTable,
        private readonly validationService: PointValidationService,
    ) {}

    /**
     * 특정 유저의 포인트 조회
     * @param userId - 조회할 유저의 ID
     * @returns 유저의 포인트 정보
     */
    async getUserPoint(userId: number): Promise<UserPoint> {
        const userPointInfo = await this.userDb.selectById(userId);
        return userPointInfo;
    }

    /**
     * 특정 유저의 포인트 충전/이용 내역 조회
     * @param userId - 조회할 유저의 ID
     * @returns 유저의 포인트 충전/이용 내역 배열
     */
    async getPointHistories(userId: number): Promise<PointHistory[]> {
        return this.historyDb.selectAllByUserId(userId);
    }

    /**
     * 특정 유저의 포인트 충전
     * @param userId - 포인트를 충전할 유저의 ID
     * @param amount - 충전할 포인트 금액
     * @returns 충전 후 갱신된 유저의 포인트 정보
     * @throws BadRequestException - 금액이 유효하지 않거나 최소 충전 금액 미만인 경우
     */
    async chargePoint(userId: number, amount: number): Promise<UserPoint> {
        this.validationService.validateAmount(amount); // 금액 기본 검증
        this.validationService.validateMinChargeAmount(amount); // 최소 충전 금액 검증

        const transactionType: TransactionType = TransactionType.CHARGE;
        const {point: prevAmount} = await this.userDb.selectById(userId);
        this.validationService.validateMaxBalance(prevAmount, amount); // 최대 잔고 초과 검증

        const newAmount = prevAmount+amount;
        return this.updateUserPointAndHistory(userId, newAmount, transactionType);
    }

    /**
     * 특정 유저의 포인트 사용
     * @param userId - 포인트를 사용할 유저의 ID
     * @param amount - 사용할 포인트 금액
     * @returns 사용 후 갱신된 유저의 포인트 정보
     * @throws BadRequestException - 잔고 부족, 최소 금액 미만, 금액 유효하지 않은 경우
     */
    async usePoint(userId: number, amount: number): Promise<UserPoint> {
        this.validationService.validateAmount(amount);
        this.validationService.validateMinUseAmount(amount);

        const transactionType: TransactionType = TransactionType.USE;
        const {point: prevAmount} = await this.userDb.selectById(userId);
        this.validationService.validateSufficientBalance(prevAmount, amount);

        const newAmount = prevAmount-amount;
        return this.updateUserPointAndHistory(userId, newAmount, transactionType);
    }

    /**
     * 유저 포인트 갱신 및 갱신 내역 히스토리 기록
     * @param userId - 포인트를 갱신할 유저의 ID
     * @param newAmount - 갱신할 새로운 포인트 금액
     * @param transactionType - 트랜잭션 유형 (CHARGE/USE)
     * @returns 갱신된 유저의 포인트 정보
     * @throws BadRequestException - 포인트 업데이트 또는 히스토리 기록 실패 시
     */
    private async updateUserPointAndHistory(
        userId: number,
        newAmount: number,
        transactionType: TransactionType,
    ): Promise<UserPoint> {
        const currentUser = await this.userDb.selectById(userId);
        let historyId: PointHistory = null;

        try {
            const updatedPointInfo = await this.userDb.insertOrUpdate(userId, newAmount);
            const {updateMillis} = updatedPointInfo;

            historyId = await this.historyDb.insert(userId, newAmount, transactionType, updateMillis);

            return updatedPointInfo;
        } catch (error) {
            if (currentUser) await this.userDb.insertOrUpdate(userId, currentUser.point); // 포인트 롤백
            // if (historyId !== null) await this.historyDb.delete(historyId); // 히스토리 롤백
            throw new Error('포인트 업데이트 또는 기록 저장 실패');
        }
    }
}
