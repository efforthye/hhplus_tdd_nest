import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PointValidationService {
    private readonly MAX_BALANCE    = 1000000; // 최대 잔고: 100만 포인트
    private readonly MIN_USE_AMOUNT = 500;     // 최소 사용 금액: 500 포인트
    private readonly MIN_CHARGE_AMOUNT = 5000; // 최소 충전 금액: 5000 포인트

    /**
     * 금액 유효성 검증
     * @param amount - 검증할 금액
     * @throws BadRequestException - 금액이 0 이하이거나 정수가 아닌 경우
     */
    validateAmount(amount: number): void {
        if (amount <= 0) throw new BadRequestException('금액은 0보다 커야 합니다.');
        if (!Number.isInteger(amount)) throw new BadRequestException('금액은 정수여야 합니다.');
    }

    /**
     * 최대 잔고 초과 여부 확인
     * @param currentPoint - 현재 잔고
     * @param addAmount - 추가 금액
     * @throws BadRequestException - 잔고 초과 시
     */
    validateMaxBalance(currentPoint: number, addAmount: number): void {
        const maxBalance = this.MAX_BALANCE;
        const newBalance = currentPoint+addAmount;
        if (newBalance > maxBalance) {
            throw new BadRequestException(`최대 잔고 ${maxBalance} 포인트를 초과할 수 없습니다.`);
        }
    }

    /**
     * 최소 사용 금액 검증
     * @param amount - 검증할 금액
     * @throws BadRequestException - 최소 금액 미만인 경우
     */
    validateMinUseAmount(amount: number): void {
        const minUseAmount = this.MIN_USE_AMOUNT;
        if (amount < minUseAmount) {
            throw new BadRequestException(`최소 사용 금액은 ${minUseAmount} 포인트 이상이어야 합니다.`);
        }
    }

    /**
     * 최소 충전 금액 검증
     * @param amount - 충전할 포인트 금액
     * @throws BadRequestException - 금액이 최소 충전 금액 미만인 경우
     */
    validateMinChargeAmount(amount: number): void {
        const minChargeAmount = this.MIN_CHARGE_AMOUNT;
        if (amount < minChargeAmount) {
            throw new BadRequestException(
                `충전 금액은 최소 ${minChargeAmount} 포인트 이상이어야 합니다.`,
            );
        }
    }

    /**
     * 잔액 부족 여부 확인
     * @param currentBalance - 현재 잔액
     * @param deductedAmount - 차감 금액
     * @throws BadRequestException - 잔액 부족 시
     */
    validateSufficientBalance(currentBalance: number, deductedAmount: number): void {
        if (currentBalance < deductedAmount) {
            throw new BadRequestException(
                `잔액이 부족합니다. 현재 잔고: ${currentBalance} 포인트, 필요한 금액: ${deductedAmount} 포인트.`,
            );
        }
    }
}
