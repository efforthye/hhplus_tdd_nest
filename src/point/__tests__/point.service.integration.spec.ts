import { PointService } from '../point.service';
import { PointValidationService } from '../point-validation.service';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { TransactionType } from '../point.model';
import { UserPointTable } from 'src/database/userpoint.table';
import { Mutex } from 'async-mutex';

describe('PointService - Integration Tests', () => {
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

    // 동시성 충돌 없이 충전 및 사용에 성공하는지 확인
    it('동시성 충돌 없이 충전 및 사용에 성공', async () => {
        const tasks = [
            pointService.chargePoint(1, 5000),   // +5000 -> 15000
            pointService.usePoint(1, 3000),      // -3000 -> 12000
            pointService.chargePoint(1, 5000),   // +5000 -> 17000
            pointService.usePoint(1, 7000),      // -7000 -> 10000
        ];

        const results = await Promise.all(tasks);

        expect(results[0].point).toBe(15000);
        expect(results[1].point).toBe(12000);
        expect(results[2].point).toBe(17000);
        expect(results[3].point).toBe(10000);
    });

    // 연속 사용 요청 시 부분 성공 테스트
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

    // 여러 유저 간 독립성 테스트
    it('여러 유저 간 독립적 트랜잭션 처리', async () => {
        const user1Request = pointService.chargePoint(1, 5000);
        const user2Request = pointService.usePoint(2, 5000);

        const results = await Promise.all([user1Request, user2Request]);

        expect(results[0].point).toBe(15000); // 10000 + 5000
        expect(results[1].point).toBe(15000); // 20000 - 5000
    });

    // 복합적인 충전과 사용 요청 처리
    it('복합적인 충전과 사용 요청 동시 처리', async () => {
        const requests = [
            pointService.chargePoint(1, 10000),
            pointService.usePoint(1, 3000),
            pointService.chargePoint(1, 5000),
            pointService.usePoint(1, 7000),
        ];

        const results = await Promise.all(requests);

        expect(results[0].point).toBe(20000);
        expect(results[1].point).toBe(17000);
        expect(results[2].point).toBe(22000);
        expect(results[3].point).toBe(15000);
    });

    // 에러 발생 시 롤백 처리 확인
    it('에러 발생 시 롤백 처리', async () => {
        const initialPoint = 10000;
        userDb.selectById.mockResolvedValue({ 
            id: 1, 
            point: initialPoint, 
            updateMillis: Date.now() 
        });

        // 첫 번째 insertOrUpdate 호출에서 실패하도록 설정
        userDb.insertOrUpdate
            .mockRejectedValueOnce(new Error('DB 업데이트 실패'))
            .mockResolvedValueOnce({ 
                id: 1, 
                point: initialPoint, 
                updateMillis: Date.now() 
            });

        await expect(pointService.chargePoint(1, 5000))
            .rejects.toThrow('포인트 업데이트 또는 기록 저장 실패');

        // 롤백되어 초기 포인트 유지 확인
        expect(userDb.insertOrUpdate).toHaveBeenLastCalledWith(1, initialPoint);
        expect(historyDb.insert).not.toHaveBeenCalled();
    });

    // 동시 사용 요청 시 데이터 일관성 유지
    it('동시 사용 요청 시 데이터 일관성 유지', async () => {
        const firstUseRequest = pointService.usePoint(1, 3000);
        const secondUseRequest = pointService.usePoint(1, 4000);

        const results = await Promise.all([firstUseRequest, secondUseRequest]);

        expect(results[0].point).toBe(7000);
        expect(results[1].point).toBe(3000);
    });
});