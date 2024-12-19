import { PointService } from '../point.service';
import { PointValidationService } from '../point-validation.service';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { TransactionType, UserPoint } from '../point.model';
import { UserPointTable } from 'src/database/userpoint.table';

describe('PointService - Unit Tests', () => {
    let pointService: PointService;
    let validationService: PointValidationService;
    let userDb: jest.Mocked<UserPointTable>;
    let historyDb: jest.Mocked<PointHistoryTable>;

    beforeEach(() => {
        validationService = new PointValidationService();
        userDb = {
            selectById: jest.fn(),
            insertOrUpdate: jest.fn(),
            selectAllByUserId: jest.fn(),
        } as unknown as jest.Mocked<UserPointTable>;

        historyDb = {
            insert: jest.fn(),
            selectAllByUserId: jest.fn(),
        } as unknown as jest.Mocked<PointHistoryTable>;

        pointService = new PointService(userDb, historyDb, validationService);
    });

    // 특정 유저의 포인트 조회 테스트
    it('유저 포인트가 정상 조회되는지 확인', async () => {
        const mockUserPointInfo: UserPoint = {id: 1, point: 10000, updateMillis: Date.now()};
        userDb.selectById.mockResolvedValue(mockUserPointInfo);

        const result = await pointService.getUserPoint(1);

        expect(result).toEqual(mockUserPointInfo);
        expect(userDb.selectById).toHaveBeenCalledWith(1);
    });

    // 포인트 내역 조회 테스트
    it('유저의 거래 내역이 없는 경우 빈 배열 반환에 성공하는지 확인', async () => {
        historyDb.selectAllByUserId.mockResolvedValue([]);
        const result = await pointService.getPointHistories(1);

        expect(result).toEqual([]);
        expect(historyDb.selectAllByUserId).toHaveBeenCalledWith(1);
        expect(historyDb.selectAllByUserId).toHaveBeenCalledTimes(1);
    });

    it('유저 거래 내역이 있는 경우 조회에 성공하는지 확인', async () => {
        const mockHistories = [
            {id: 1, userId: 1, amount: 5000, type: TransactionType.CHARGE, timeMillis: Date.now() - 3000},
            {id: 2, userId: 1, amount: 3000, type: TransactionType.USE, timeMillis: Date.now() - 2000},
            {id: 3,  userId: 1, amount: 10000, type: TransactionType.CHARGE, timeMillis: Date.now() - 1000},
        ];
        historyDb.selectAllByUserId.mockResolvedValue(mockHistories);

        const result = await pointService.getPointHistories(1);

        expect(result).toEqual(mockHistories);
        expect(historyDb.selectAllByUserId).toHaveBeenCalledWith(1);
        expect(historyDb.selectAllByUserId).toHaveBeenCalledTimes(1);
    });

    // 포인트 충전 입력 유효성 검사 테스트
    it('포인트 충전 금액이 NaN일 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, NaN)).rejects.toThrow('금액은 정수여야 합니다.');
    });

    it('포인트 충전 금액이 Infinity일 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, Infinity)).rejects.toThrow('금액은 정수여야 합니다.');
    });

    it('포인트 충전 금액이 문자열일 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, '1000' as any)).rejects.toThrow('금액은 정수여야 합니다.');
    });

    it('포인트 충전 금액이 실수인 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, 1000.5)).rejects.toThrow('금액은 정수여야 합니다.');
    });

    it('포인트 충전 금액이 음수인 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, -1000)).rejects.toThrow('금액은 0보다 커야 합니다.');
    });

    // 포인트 충전 테스트
    it('포인트 충전 성공', async () => {
        const currentTime = Date.now();

        userDb.selectById.mockResolvedValue({id: 1, point: 5000, updateMillis: currentTime});
        historyDb.insert.mockResolvedValue({
            id: 1,
            userId: 1,
            amount: 5000,
            type: TransactionType.CHARGE,
            timeMillis: currentTime
        });
        userDb.insertOrUpdate.mockResolvedValue({
            id: 1, 
            point: 10000, 
            updateMillis: currentTime
        });

        const result = await pointService.chargePoint(1, 5000);

        expect(result.point).toBe(10000);
        expect(userDb.insertOrUpdate).toHaveBeenCalledWith(1, 10000);
        expect(historyDb.insert).toHaveBeenCalledTimes(1);
    });

    // 최대 잔고 초과 충전 테스트
    it('최대 잔고 초과 시 예외 발생', async () => {
        userDb.selectById.mockResolvedValue({ id: 1, point: 999500, updateMillis: Date.now() });
        await expect(pointService.chargePoint(1, 10000)).rejects.toThrow('최대 잔고 1000000 포인트를 초과할 수 없습니다.');
    });

    // 최소 충전 금액 테스트
    it('최소 충전 금액 미만일 경우 예외 발생', async () => {
        await expect(pointService.chargePoint(1, 4000)).rejects.toThrow(
            '충전 금액은 최소 5000 포인트 이상이어야 합니다.',
        );
    });

    // 포인트 사용 테스트
    it('포인트 사용 성공', async () => {
        const currentTime = Date.now();
        userDb.selectById.mockResolvedValue({ 
            id: 1, 
            point: 10000, 
            updateMillis: currentTime 
        });
        userDb.insertOrUpdate.mockResolvedValue({ 
            id: 1, 
            point: 5000, 
            updateMillis: currentTime 
        });
        historyDb.insert.mockResolvedValue({
            id: 1,
            userId: 1,
            amount: 5000,
            type: TransactionType.USE,
            timeMillis: currentTime
        });

        const result = await pointService.usePoint(1, 5000);

        expect(result.point).toBe(5000);
        expect(userDb.insertOrUpdate).toHaveBeenCalledWith(1, 5000);
        expect(historyDb.insert).toHaveBeenCalledTimes(1);
    });

    // 잔액 부족 사용 테스트
    it('잔액 부족 시 예외 발생', async () => {
        userDb.selectById.mockResolvedValue({ id: 1, point: 400, updateMillis: Date.now() });

        await expect(pointService.usePoint(1, 500)).rejects.toThrow(
            '잔액이 부족합니다. 현재 잔고: 400 포인트, 필요한 금액: 500 포인트.',
        );
    });
});