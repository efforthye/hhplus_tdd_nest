import { PointService } from '../point.service';
import { PointValidationService } from '../point-validation.service';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { TransactionType } from '../point.model';
import { UserPointTable } from 'src/database/userpoint.table';
import { Mutex } from 'async-mutex';

describe('PointService - Advanced Integration Tests', () => {
    let pointService: PointService;
    let validationService: PointValidationService;
    let userDb: jest.Mocked<UserPointTable>;
    let historyDb: jest.Mocked<PointHistoryTable>;
    let points: Map<number, number>;

    beforeEach(() => {
        jest.setTimeout(10000);
        
        validationService = new PointValidationService();
        
        // 초기 포인트 상태 설정
        points = new Map([[1, 10000], [2, 20000]]);
        
        const lockMap = new Map();
        const runWithLock = async (userId, callback) => {
            let mutex = lockMap.get(userId);
            if (!mutex) {
                mutex = new Mutex();
                lockMap.set(userId, mutex);
            }
            return await mutex.runExclusive(callback);
        };

        userDb = {
            selectById: jest.fn(async (userId) => {
                return await runWithLock(userId, async () => {
                    return { 
                        id: userId, 
                        point: points.get(userId) || 0, 
                        updateMillis: Date.now() 
                    };
                });
            }),
            insertOrUpdate: jest.fn(async (userId, point) => {
                return await runWithLock(userId, async () => {
                    points.set(userId, point);
                    return { 
                        id: userId, 
                        point, 
                        updateMillis: Date.now() 
                    };
                });
            }),
            selectAllByUserId: jest.fn(),
        } as unknown as jest.Mocked<UserPointTable>;

        historyDb = {
            insert: jest.fn((userId, amount, type, timeMillis) => {
                const historyId = Math.random();
                return Promise.resolve({ 
                    id: historyId, 
                    userId, 
                    amount, 
                    type, 
                    timeMillis 
                });
            }),
            selectAllByUserId: jest.fn(),
        } as unknown as jest.Mocked<PointHistoryTable>;

        pointService = new PointService(userDb, historyDb, validationService);
    });

    // 동시 요청으로 인한 데이터 무결성 확인 테스트
    it('동시 요청으로 인한 데이터 무결성 확인', async () => {
        let currentPoint = 10000;
        
        userDb.selectById.mockImplementation(async () => ({
            id: 1,
            point: currentPoint,
            updateMillis: Date.now()
        }));

        userDb.insertOrUpdate.mockImplementation(async (id, point) => {
            currentPoint = point;
            return {
                id,
                point,
                updateMillis: Date.now()
            };
        });

        const firstRequest = pointService.chargePoint(1, 5000);
        const secondRequest = pointService.chargePoint(1, 5000);

        const results = await Promise.all([firstRequest, secondRequest]);

        expect(results[0].point).toBe(15000);
        expect(results[1].point).toBe(20000);
        expect(currentPoint).toBe(20000);
    });

    // 포인트 사용 중 충전 시도 테스트 (첫 번째 변형)
    it('포인트 사용 중 충전 시도 - 첫 번째 변형', async () => {
        userDb.selectById
            .mockResolvedValueOnce({ id: 1, point: 10000, updateMillis: 1 })
            .mockResolvedValueOnce({ id: 1, point: 7000, updateMillis: 2 })
            .mockResolvedValueOnce({ id: 1, point: 7000, updateMillis: 2 })
            .mockResolvedValueOnce({ id: 1, point: 12000, updateMillis: 3 });

        userDb.insertOrUpdate
            .mockResolvedValueOnce({ id: 1, point: 7000, updateMillis: 2 })
            .mockResolvedValueOnce({ id: 1, point: 12000, updateMillis: 3 });

        historyDb.insert
            .mockResolvedValueOnce({ 
                id: 1, 
                userId: 1, 
                amount: 3000, 
                type: TransactionType.USE, 
                timeMillis: expect.any(Number) 
            })
            .mockResolvedValueOnce({ 
                id: 2, 
                userId: 1, 
                amount: 5000, 
                type: TransactionType.CHARGE, 
                timeMillis: expect.any(Number) 
            });

        const useRequest = pointService.usePoint(1, 3000);
        const chargeRequest = pointService.chargePoint(1, 5000);

        const results = await Promise.all([useRequest, chargeRequest]);

        expect(results[0].point).toBe(7000);
        expect(results[1].point).toBe(12000);
    });

    // 포인트 사용 중 충전 시도 테스트 (두 번째 변형)
    it('포인트 사용 중 충전 시도 - 두 번째 변형', async () => {
        let currentPoint = 10000;
        const useAmount = 3000;
        const chargeAmount = 5000;
        
        userDb.selectById.mockImplementation(async () => ({
            id: 1,
            point: currentPoint,
            updateMillis: Date.now()
        }));

        userDb.insertOrUpdate.mockImplementation(async (id, point) => {
            currentPoint = point;
            return {
                id,
                point,
                updateMillis: Date.now()
            };
        });

        const useRequest = pointService.usePoint(1, useAmount);
        const chargeRequest = pointService.chargePoint(1, chargeAmount);

        const results = await Promise.all([useRequest, chargeRequest]);

        expect(results[0].point).toBe(7000);
        expect(results[1].point).toBe(12000);
        expect(currentPoint).toBe(12000);
    });

    // 포인트 사용 중 추가 사용 시도 테스트
    it('포인트 사용 중 추가 사용 시도', async () => {
        let currentPoint = 10000;
        
        userDb.selectById.mockImplementation(async () => ({
            id: 1,
            point: currentPoint,
            updateMillis: Date.now()
        }));

        userDb.insertOrUpdate.mockImplementation(async (id, point) => {
            currentPoint = point;
            return {
                id,
                point,
                updateMillis: Date.now()
            };
        });

        const firstUseRequest = pointService.usePoint(1, 3000);
        const secondUseRequest = pointService.usePoint(1, 4000);

        const results = await Promise.all([firstUseRequest, secondUseRequest]);

        expect(results[0].point).toBe(7000);
        expect(results[1].point).toBe(3000);
        expect(currentPoint).toBe(3000);
    });

    // 연속 사용 요청 시 일부 성공 일부 실패 테스트
    it('연속 사용 요청 시 일부 성공 일부 실패', async () => {
        const useRequests = Array(5).fill(null).map(() => 
            pointService.usePoint(1, 3000)
        );

        const results = await Promise.allSettled(useRequests);

        const successResults = results.filter(r => r.status === 'fulfilled');
        const failResults = results.filter(r => r.status === 'rejected');

        expect(successResults).toHaveLength(3);
        expect(failResults).toHaveLength(2);
    });

    // 복합적인 충전과 사용 요청 처리 테스트
    it('복합적인 충전과 사용 요청 처리', async () => {
        let currentPoint = 5000;
        
        userDb.selectById.mockImplementation(async () => ({
            id: 1,
            point: currentPoint,
            updateMillis: Date.now()
        }));

        userDb.insertOrUpdate.mockImplementation(async (id, point) => {
            currentPoint = point;
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
                id,
                point,
                updateMillis: Date.now()
            };
        });

        const requests = [
            pointService.chargePoint(1, 10000),
            pointService.usePoint(1, 3000),
            pointService.chargePoint(1, 5000),
            pointService.usePoint(1, 7000),
        ];

        const results = await Promise.all(requests);

        expect(results[0].point).toBe(15000);
        expect(results[1].point).toBe(12000);
        expect(results[2].point).toBe(17000);
        expect(results[3].point).toBe(10000);
        expect(currentPoint).toBe(10000);
    });

    // 에러 발생 시 롤백 처리 확인 테스트
    it('에러 발생 시 롤백 처리', async () => {
        const currentPoint = 10000;
        userDb.selectById.mockResolvedValue({ 
            id: 1, 
            point: currentPoint, 
            updateMillis: Date.now() 
        });
        userDb.insertOrUpdate
            .mockRejectedValueOnce(new Error('DB 업데이트 실패'))
            .mockResolvedValueOnce({ id: 1, point: currentPoint, updateMillis: Date.now() });

        await expect(pointService.chargePoint(1, 5000))
            .rejects.toThrow('포인트 업데이트 또는 기록 저장 실패');

        expect(userDb.insertOrUpdate).toHaveBeenLastCalledWith(1, currentPoint);
        expect(historyDb.insert).not.toHaveBeenCalled();
    });

    // 여러 유저 간 독립성 테스트
    it('여러 유저 간 독립성 테스트', async () => {
        const points = new Map([
            [1, 10000],
            [2, 20000]
        ]);

        userDb.selectById.mockImplementation(async (userId) => ({
            id: userId,
            point: points.get(userId),
            updateMillis: Date.now()
        }));

        userDb.insertOrUpdate.mockImplementation(async (userId, point) => {
            points.set(userId, point);
            return {
                id: userId,
                point,
                updateMillis: Date.now()
            };
        });

        const user1Request = pointService.chargePoint(1, 5000);
        const user2Request = pointService.usePoint(2, 5000);

        const results = await Promise.all([user1Request, user2Request]);

        expect(points.get(1)).toBe(15000); // 10000 + 5000
        expect(points.get(2)).toBe(15000); // 20000 - 5000
        expect(results[0].point).toBe(15000);
        expect(results[1].point).toBe(15000);
        expect(userDb.insertOrUpdate).toHaveBeenCalledTimes(2);
        expect(historyDb.insert).toHaveBeenCalledTimes(2);
    });
});