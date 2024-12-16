import { PointValidationService } from '../point-validation.service';
import { BadRequestException } from '@nestjs/common';

describe('PointValidationService', () => {
    let validationService: PointValidationService;

    beforeEach(() => {
        validationService = new PointValidationService();
    });

    // 테스트 이유: 0 이하의 의미 없는 포인트 충전/사용 방지
    it('금액이 0 이하일 경우 예외 발생', () => {
        expect(() => validationService.validateAmount(0)).toThrowError('금액은 0보다 커야 합니다.');
        expect(() => validationService.validateAmount(-1)).toThrowError('금액은 0보다 커야 합니다.');
    });

    // 테스트 이유: 너무 적은 금액의 충전은 시스템 리소스 낭비를 방지하기 위함
    it('최소 충전 금액 미만일 경우 예외 발생', () => {
        expect(() => validationService.validateMinChargeAmount(4999)).toThrowError(
            '충전 금액은 최소 5000 포인트 이상이어야 합니다.',
        );
    });

    // 테스트 이유: 포인트 시스템은 정수 단위만 허용하기 때문에 무결성을 보장하기 위함
    it('금액이 소수점일 경우 예외 발생', () => {
        expect(() => validationService.validateAmount(100.5)).toThrowError('금액은 정수여야 합니다.');
    });

    // 테스트 이유: 시스템에서 허용하는 최대 잔고를 초과하지 않도록 제한하기 위함
    it('최대 잔고 초과 시 예외 발생', () => {
        expect(() => validationService.validateMaxBalance(999900, 200)).toThrowError(
            '최대 잔고 1000000 포인트를 초과할 수 없습니다.',
        );
    });

    // 테스트 이유: 포인트 사용 시 잔고가 부족하면 오류를 발생시켜 시스템 무결성을 보장하기 위함
    it('잔액 부족 시 예외 발생', () => {
        expect(() => validationService.validateSufficientBalance(400, 500)).toThrowError(
            '잔액이 부족합니다. 현재 잔고: 400 포인트, 필요한 금액: 500 포인트.',
        );
    });

    // 테스트 이유: 너무 적은 포인트 사용을 방지하고 시스템의 효율성을 유지하기 위함
    it('최소 사용 금액 미만일 경우 예외 발생', () => {
        expect(() => validationService.validateMinUseAmount(499)).toThrowError(
            '최소 사용 금액은 500 포인트 이상이어야 합니다.',
        );
    });
});
