
# 동시성 제어 방식에 대한 분석 및 보고서

## 📚 목차
- [동시성 제어의 의의](#동시성-제어의-의의)
  - [동시성 제어란?](#동시성-제어란)
  - [동시성 제어가 필요한 이유?](#동시성-제어가-필요한-이유)
  - [해결되지 않을 시 발생 가능한 여러 가지 문제](#해결되지-않을-시-발생-가능한-여러-가지-문제)
- [환경별 동시성 제어 방법](#환경별-동시성-제어-방법)
  - [데이터베이스 레벨에서의 해결 방법](#데이터베이스-레벨에서의-해결-방법)
    - [트랜잭션 격리 수준에서의 방지](#트랜잭션-격리-수준에서의-방지)
      - [READ COMMITTED](#read-committed)
      - [SERIALIZABLE](#serializable)
      - [Dirty Read란 무엇인가?](#dirty-read란-무엇인가)
    - [락 메커니즘을 적용](#락-메커니즘을-적용)
      - [낙관적 락](#낙관적-락)
      - [비관적 락](#비관적-락)
  - [애플리케이션 레벨에서의 해결 방법](#애플리케이션-레벨에서의-해결-방법)
    - [세마포어 (Semaphore)](#세마포어-semaphore)
      - [세마포어를 활용한 포인트 사용 예시](#세마포어를-활용한-포인트-사용-예시)
    - [캐시 동기화](#캐시-동기화)
      - [Redis를 활용한 글로벌 락 예시](#redis를-활용한-글로벌-락-예시)
    - [뮤텍스 (Mutex)](#뮤텍스-mutex)
      - [뮤텍스를 활용한 포인트 사용 예시](#뮤텍스를-활용한-포인트-사용-예시)
  - [시스템 아키텍처 레벨에서의 해결 방법](#시스템-아키텍처-레벨에서의-해결-방법)
    - [CQRS 패턴](#cqrs-패턴)
    - [비동기 큐](#비동기-큐)
      - [Bull을 활용한 비동기 충전 예시](#bull을-활용한-비동기-충전-예시)
      - [사용자 그룹화(샤딩 큐)](#사용자-그룹화샤딩-큐)
      - [사용자 태그 활용](#사용자-태그-활용)

---

## 동시성 제어의 의의

### 동시성 제어란?
- 동시성 제어란 여러 사용자나 시스템이 데이터베이스나 파일 시스템 같은 공유 자원에 동시에 액세스할 때 발생할 수 있는 문제(동시성 문제)들을 관리하고 해결하기 위한 기술입니다. 
- 이는 데이터의 일관성과 정확성(무결성)을 유지하면서, 여러 요청이 서로 간섭하지 않고 동시에 처리될 수 있도록 보장하는 역할을 합니다.

### 동시성 제어가 필요한 이유?
- 데이터 충돌 방지: 여러 프로세스가 동일한 데이터를 동시에 변경하려고 하면 충돌이 발생할 수 있습니다.
- 정확한 작업 수행: 동시 실행되는 작업이 간섭하지 않고 의도된 결과를 보장하여야 합니다.
- 교착 상태 방지: 작업 대기열의 막힘이 생길 수 있어 방지하여야 합니다.

### 해결되지 않을 시 발생 가능한 여러 가지 문제..
- 데이터 손실: 한 프로세스의 데이터 수정이 다른 프로세스에 의해 덮어씌워지는 심각한 문제가 생길 수 있습니다.
- 데드락: 두 작업이 서로의 자원을 기다리며 무한 대기 상태에 빠질 수 있습니다.
- 불완전 데이터 참조: 트랜잭션 실패로 인해 참조된 데이터가 손상될 수 있습니다.


## 환경별 동시성 제어 방법

### 데이터베이스 레벨에서의 해결 방법
1. 트랜잭션 격리 수준에서의 방지
   - `READ COMMITTED`: Dirty Read를 방지할 수 있습니다.
   - `SERIALIZABLE`: 최고 수준의 무결성을 보장할 수 있습니다.
    #### Dirty Read란 무엇인가...?
    - 덜티 리드는 트랜잭션이 처리 중인 커밋되지 않은 데이터를 읽는 것을 의미합니다. 이는 데이터 일관성을 해칠 수 있는 문제를 발생시킬 수 있습니다.
    - 이번 과제에 나온 포인트를 예시로 들면 다음과 같습니다. 
        1. 특정 사용자가 10,000포인트를 보유 중이었고, 9,000포인트를 사용하려는 트랜잭션을 시작합니다. (10,000-9,000)
        2. 동시에 5,000포인트를 충전하는 트랜잭션을 시작할 때, 9,000포인트 사용 트랜잭션이 커밋되지 않은 상태에서 기존 10,000포인트를 잘못 읽고 계산을 진행하여 15,000원이 저장됩니다. (10,000+5,000)
        - 위와 같은 경우, 실제로는 10,000-9,000+5,000=6,000 포인트가 남아야 하는데 더티 리드 때문에 15,000포인트로 잘못 계산되어 로직상 9,000원의 손해가 발생하게 됩니다. 이는 서비스에 심각한 피해를 입히게 될 수 있습니다.

2. 락 메커니즘을 적용
   - 낙관적 락: 낙관적 락은 데이터를 읽을 때 별다른 락을 걸지 않고, 데이터를 갱신하기 직전에 충돌 여부를 검증하기 때문에 충돌 발생 가능성이 낮은 경우 적합합니다. ex) 충돌 가능성이 낮고, 여러 사용자 작업이 독립적일 때 적합합니다. ex) 게시글 작성 등
   - 비관적 락: 데이터를 읽는 순간부터 락을 걸어 다른 트랜잭션이 해당 데이터를 수정하지 못하도록 하기 때문에, 데이터 충돌 가능성이 높은 상황에서 강력한 보호가 가능합니다. 이는 충돌 가능성이 높으며, 데이터 무결성이 중요한 경우에 많이 사용합니다. ex) 계좌 이체 등.
    #### 비관적 락의 예시 - 포인트 충전 트랜잭션
    ```typescript
    // 아래 코드는 데이터베이스 트랜잭션을 이용하여 포인트 충전을 처리하여 안전하게 처리합니다.
    async function rechargePoints(userId: string, points: number) {
        await database.transaction(async (trx) => {
            // 트랜잭션 내에서 forUpdate()로 잠금을 걸어 사용자 정보를 가져옵니다.
            const user = await trx('users').where('id', userId).forUpdate().first();
            // 현재 포인트와 충전 포인트를 더해 새로운 값을 계산합니다.
            const updatedPoints = user.points + points;
            // 업데이트된 포인트 값을 데이터베이스에 저장합니다.
            await trx('users').where('id', userId).update({ points: updatedPoints });
        });
    }
    ```


### 애플리케이션 레벨에서의 해결 방법
1. 세마포어 (Semaphore): 세마포어는 동시에 접근 가능한 작업의 개수를 제한하여 리소스 효율성을 극대화합니다. 단일 서버와 분산 서버 환경 모두에서 유용하게 사용됩니다.
    - 장점: 병렬 처리를 제한적으로 허용하여 리소스 효율성을 높이고, 충돌을 방지합니다.
    - 단점: 설정 값이 부적절할 경우, 과도한 대기 상태나 성능 저하가 발생할 수 있습니다.
    #### 세마포어를 활용한 포인트 사용 예시
    ```typescript
    import { Semaphore } from 'async-mutex';
    // 최대 3개의 동시 작업을 허용하도록 설정합니다.
    const semaphore = new Semaphore(3);

    async function fetchData(url: string) {
        const [acquire, release] = await semaphore.acquire();
        try {
            // 외부 API를 호출합니다.
            const response = await fetch(url);
            return await response.json();
        } finally {
            // 작업 완료 후 세마포어를 릴리즈 시킵니다.
            release();
        }
    }

    // 아래 함수와 같이 호출하면 여러 URL을 동시에 처리할 수 있습니다.
    async function fetchMultipleData(urls: string[]) {
        return await Promise.all(urls.map((url) => fetchData(url)));
    }
    ```
2. 캐시 동기화: Redis와 같은 분산 캐시를 활용하여 글로벌 동기화를 처리합니다. 특히 다중 서버 환경에서 락(Lock)과 TTL(Time-To-Live)을 조합하여 데이터의 일관성을 유지할 수 있습니다.
    - 장점: 분산 환경에서 동시성 문제를 효과적으로 완화하며, 높은 동시성을 지원합니다.
    - 단점: 락 관리에 추가적인 리소스가 소모되고, 네트워크 지연으로 인한 락 실패 가능성이 존재합니다.
    #### Redis를 활용한 글로벌 락 예시
    ```typescript
    import { createClient } from 'redis';
    const redisClient = createClient();

    async function rechargePoints(userId: string, points: number) {
        // redisClient.set()을 통해 사용자별 고유한 락 키를 생성합니다.
        // NX: 키가 없을 때만 설정되도록 함, EX: 키의 만료 시간을 5초로 설정하여 데드락(교착 상태/둘 이상의 프로세스가 다른 프로세스가 점유하고 있는 자원을 서로 기다릴 때 무한 대기에 빠지는 상황)을 방지함
        const lockKey = `lock:${userId}`; 
        const lockAcquired = await redisClient.set(lockKey, '1', { NX: true, EX: 5 });
        // if (!lockAcquired) throw new Error('Unable to acquire lock');

        try {
            // 사용자 정보를 가져와 포인트를 업데이트합니다.
            const user = await getUser(userId);
            const updatedPoints = user.points + points;
            await updateUserPoints(userId, updatedPoints);
        } finally {
            // 글로벌 락을 해제합니다.
            await redisClient.del(lockKey);
        }
    }
    ```

3. 뮤텍스 (Mutex): 뮤텍스는 단일 리소스 보호에 특화된 상호 배제(Mutual Exclusion) 메커니즘을 사용합니다. 주로 단일 서버 환경에서 사용되며, 구현이 상대적으로 단순합니다.
    - 장점: 특정 리소스에 대한 동시 접근을 완벽히 차단하며, 데이터의 무결성을 보장합니다.
    - 단점: 병렬 처리 성능이 제한될 수 있으며, 분산 환경에서는 별도의 동기화 도구(예: Redis)가 필요합니다.
    #### 뮤텍스를 활용한 포인트 사용 예시
    ```typescript
    import { Mutex } from 'async-mutex';
    const mutex = new Mutex();

    async function usePoints(userId: string, points: number) {
        // acquire()를 통해 뮤텍스 잠금을 획득합니다. 잠금이 설정되면 다른 작업은 잠금이 해제될 때까지 대기 상태가 되며, 추후 비동기 작업에서 잠금 해제를 보장하기 위해 반환된 release 함수를 호출해야 합니다.
        const release = await mutex.acquire();
        try {
            // 사용자 정보를 조회하고 포인트를 업데이트 합니다.
            const user = await getUser(userId);
            if (user.points < points) {
                throw new Error('Insufficient points');
            }
            await updateUserPoints(userId, user.points - points);
        } finally {
            // finally 블록에서 뮤텍스 잠금을 해제합니다.
            release();
        }
    }
    ```

### 시스템 아키텍처 레벨에서의 해결 방법
- CQRS 패턴: CQRS 패턴은 읽기(Query)와 쓰기(Command) 작업을 분리하여 성능을 최적화하고 데이터 일관성을 유지하는 설계 방식입니다. 읽기 작업은 성능에 초점을 맞추고 캐싱을 활용하거나 읽기 전용 데이터베이스를 사용하며, 쓰기 작업은 데이터 일관성과 무결성을 보장하기 위한 트랜잭션 중심의 처리를 사용합니다.
    - 장점: 복잡한 도메인 로직을 단순화할 수 있으며, 읽기와 쓰기의 요구 사항이 다른 경우 성능 최적화가 가능합니다.
    - 단점: 초기 구현 비용이 높으며, 아키텍처가 복잡해지면 읽기와 쓰기 사이의 데이터 동기화가 필요합니다.

- 비동기 큐: 비동기 큐는 작업을 직렬화하고 비동기적으로 처리하는 방식으로 동시성 문제를 해결합니다. RabbitMQ, Kafka, AWS SQS, Redis Streams 등이 대표적인 큐 시스템입니다. 이는 작업 큐를 사용하여 요청을 대기열에 넣고 순차적으로 처리합니다. 
    - 장점: 요청이 직렬화되므로 데이터 충돌을 방지할 수 있으며, 고부하 환경에서도 안정적인 처리량을 유지합니다. 또한 작업 실패 시 재시도 로직 구현할 수 있고, 작업이 비동기로 처리되므로 응답 시간을 단축하고 시스템 성능을 높일 수 있습니다.
    #### 큐(Bull)를 활용한 비동기 충전 예시 - Bull
    ```typescript
    import { Processor, Process } from '@nestjs/bull';
    import { Job } from 'bull';

    // @Processor: NestJS의 Bull에서 큐를 처리하기 위해 사용하는 데코레이터이다.
    @Processor('rechargeQueue')
    export class RechargeProcessor {
        // @Process: 특정 큐와 작업을 처리하기 위해 클래스와 메서드에 연결됩니다.    
        @Process()
        // Job 객체는 큐에 저장된 작업 정보를 나타내며, 여기서 job.data는 작업에 전달된 데이터(userId, points)를 포함합니다.
        async handleRecharge(job: Job<{ userId: string; points: number }>) {
            // 작업 데이터에서 userId와 points를 가져옵니다.
            const { userId, points } = job.data;

            // 사용자 정보를 조회하고 포인트를 업데이트 합니다.
            const user = await getUser(userId);
            const updatedPoints = user.points + points;
            await updateUserPoints(userId, updatedPoints);
        }
    }
    ```
    - 하지만 위와 같은 방법은 모든 사용자 작업이 동일한 큐에 들어가기 때문에 시간이 오래 걸립니다. 그렇다고 유저별로 큐를 만들면 큐의 수가 너무 많아져 관리가 어렵습니다. 이러한 경우 다음과 같이 유저별 직렬화를 보장하면서도 큐의 수를 제한하는 방법을 고려해야 합니다.
        - 사용자 그룹화(샤딩 큐): 사용자를 여러 그룹으로 나누고, 그룹별로 큐를 생성하여 큐의 수를 제한합니다. 이렇게 처리하면 동일 그룹에 속한 사용자끼리는 직렬화되지만, 다른 그룹의 사용자는 병렬 처리할 수 있습니다.
            ```typescript
            import { Queue } from 'bull';
            import { Injectable } from '@nestjs/common';

            @Injectable()
            export class UserQueueService {
                private readonly groupCount = 10; // 큐 그룹의 개수 (10개의 큐로 분리)
                private readonly groupQueues: Queue[] = [];

                constructor() {
                    // 10개의 그룹 큐 생성
                    for (let i = 0; i < this.groupCount; i++) {
                        this.groupQueues.push(new Queue(`rechargeQueue-group-${i}`));
                    }
                }

                // 사용자 ID를 해싱하여 큐 그룹을 선택
                private getGroupQueue(userId: string): Queue {
                    const groupId = this.hashUserId(userId) % this.groupCount;
                    return this.groupQueues[groupId];
                }

                private hashUserId(userId: string): number {
                    // 간단한 해싱 함수 (문자열 -> 숫자)
                    return [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
                }

                // 작업 추가
                async enqueueRecharge(userId: string, points: number) {
                    const groupQueue = this.getGroupQueue(userId); // 그룹 큐 선택
                    await groupQueue.add({ userId, points });
                }
            }
            ```
            - 장점: 사용자 수가 많아도 큐의 수는 고정되므로 관리가 쉬우며, 큐 그룹별로 병렬 처리가 가능하여 시스템 성능을 높일 수 있습니다.
            - 단점: 동일 그룹에 사용자가 몰릴 경우 병목 현상이 발생할 수 있습니다.
        - 사용자 태그 활용: Bull에서 제공하는 작업 태그(jobId)를 활용하여 유저 작업 간 독립성을 보장하여, 동일 사용자 작업을 직렬화면서 큐의 수는 고정으로 유지할 수 있습니다.
            ```typescript
            import { InjectQueue } from '@nestjs/bull';
            import { Queue } from 'bull';

            @Injectable()
            export class UserQueueService {
                constructor(
                    @InjectQueue('rechargeQueue') private readonly rechargeQueue: Queue,
                ) {}

                // 유저 작업 직렬화로 작업을 추가합니다.
                async enqueueRecharge(userId: string, points: number) {
                    await this.rechargeQueue.add(
                        { userId, points },
                        {
                            jobId: `user-${userId}`, // 사용자별 고유 작업 태그를 지정합니다.
                        },
                    );
                }
            }
            ```
            - 장점: 큐의 개수를 제한적으로 유지할 수 있으며, 작업 태그로 유저별 독립성을 보장할 수 있습니다. 같은 jobId를 가진 작업은 직렬화되어 순차적으로 실행하며, 작업이 많아져도 단일 큐로 관리가 가능합니다.
            - 단점: 단일 큐로 작업을 관리하므로, 큐 처리량이 매우 많아지면 병목이 발생할 수 있습니다.
    - 큐에 있어서는 아래와 같은 방식으로 유저별 작업 직렬화를 보장하면서도 큐의 수를 제한하여 리소스와 성능 문제를 효율적으로 해결할 수 있을 것 같다고 분석하였습니다.
        - 작업 수가 적은 경우: 단일 큐 + 작업 태그(jobId)로 직렬화.
        - 작업 수가 많지만 균등 분산 가능: 사용자 그룹화(샤딩 큐)로 처리.
        - 작업 수가 매우 많은 경우: 샤딩 큐 + 서버 확장.
