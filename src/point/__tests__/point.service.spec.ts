import { PointService } from '../point.service';
import { PointValidationService } from '../point-validation.service';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { TransactionType } from '../point.model';
import { UserPointTable } from 'src/database/userpoint.table';

describe('PointService', () => {
    let pointService: PointService;
    let validationService: PointValidationService;
    let userDb: jest.Mocked<UserPointTable>;
    let historyDb: jest.Mocked<PointHistoryTable>;

    beforeEach(() => {
        validationService = new PointValidationService();
        userDb = {
            selectById: jest.fn(),
            insertOrUpdate: jest.fn(),
        } as unknown as jest.Mocked<UserPointTable>;

        historyDb = {
            insert: jest.fn(),
        } as unknown as jest.Mocked<PointHistoryTable>;

        pointService = new PointService(userDb, historyDb, validationService);
    });

    // 테스트 이유: 정상적으로 포인트를 충전하고 업데이트되는지 검증하기 위함
    it('포인트 충전 성공', async () => {
        // 기존 포인트: 5000
        userDb.selectById.mockResolvedValue({ id: 1, point: 5000, updateMillis: Date.now() });

        // 업데이트 이후 포인트: 10000
        userDb.insertOrUpdate.mockResolvedValue({ id: 1, point: 10000, updateMillis: Date.now() });

        // 임의의 mock 반환값 지정
        historyDb.insert.mockResolvedValue({
            id: 1,
            userId: 1,
            amount: 5000,
            type: TransactionType.CHARGE,
            timeMillis: Date.now(),
        });

        // 포인트 충전
        const result = await pointService.chargePoint(1, 5000);

        // 5000에서 5000포인트 충전시 10000포인트가 맞는지 확인 
        expect(result.point).toBe(10000);
        // insertOrUpdate 함수가 한번만 호출된게 맞는지 확인
        expect(userDb.insertOrUpdate).toHaveBeenCalledTimes(1);
        // 포인트 변경 이력이 한번만 저장(호출)된게 맞는지 확인
        expect(historyDb.insert).toHaveBeenCalledTimes(1);
    });


    // 테스트 이유: 충전 정책을 준수하지 않는 경우를 방지하기 위함
    it('최소 충전 금액 미만일 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, 4000)).rejects.toThrow(
            '충전 금액은 최소 5000 포인트 이상이어야 합니다.',
        );
    });

    // 테스트 이유: 포인트 사용이 정상적으로 차감되고 히스토리에 기록되는지 검증하기 위함
    it('포인트 사용 성공', async () => {
        // userDb.selectById: 기존 포인트 10,000 포인트
        userDb.selectById.mockResolvedValue({ id: 1, point: 10000, updateMillis: Date.now() });

        // userDb.insertOrUpdate: 업데이트된 포인트 5,000 포인트
        userDb.insertOrUpdate.mockResolvedValue({ id: 1, point: 5000, updateMillis: Date.now() });

        // historyDb.insert: PointHistory 타입의 반환값 설정
        historyDb.insert.mockResolvedValue({
            id: 1,
            userId: 1,
            amount: 5000,
            type: TransactionType.USE,
            timeMillis: Date.now(),
        });

        // 포인트 사용
        const result = await pointService.usePoint(1, 5000);

        // 결과 검증
        expect(result.point).toBe(5000);
        expect(userDb.insertOrUpdate).toHaveBeenCalledTimes(1);
        expect(historyDb.insert).toHaveBeenCalledTimes(1);
    });


    // 테스트 이유: 포인트 사용 시 잔액이 부족하면 오류를 발생시켜 무결성을 보장하기 위함
    it('잔액 부족 시 예외 발생', async () => {
        userDb.selectById.mockResolvedValue({ id: 1, point: 400, updateMillis: Date.now() });

        await expect(pointService.usePoint(1, 500)).rejects.toThrow(
            '잔액이 부족합니다. 현재 잔고: 400 포인트, 필요한 금액: 500 포인트.',
        );
    });
});
