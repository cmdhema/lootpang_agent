# 🏦 ElizaOS Lending CCIP Plugin

Chainlink CCIP를 활용한 크로스체인 담보 대출 시스템입니다. ETH를 담보로 예치하고 KKCoin을 빌릴 수 있습니다.

## 🌟 주요 기능

- **담보 예치**: Ethereum Sepolia에서 ETH 담보 예치
- **크로스체인 대출**: CCIP를 통해 Base Sepolia에서 KKCoin 수령
- **대출 상환**: KKCoin으로 대출 상환
- **담보 인출**: 상환 후 담보 ETH 인출
- **실시간 상태 확인**: 담보 비율 및 대출 현황 모니터링

## 🛠️ 설정 방법

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# ElizaOS Core (필수)
OPENAI_API_KEY=your_openai_api_key_here

# Blockchain RPC URLs (필수)
ETHEREUM_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Private Key (필수 - 보안 주의!)
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234

# Smart Contract Addresses (필수)
VAULT_ADDRESS=0x1234567890123456789012345678901234567890
VAULT_SENDER_ADDRESS=0x1234567890123456789012345678901234567890
VAULT_RECEIVER_ADDRESS=0x1234567890123456789012345678901234567890
KKCOIN_ADDRESS=0x1234567890123456789012345678901234567890

# Chainlink CCIP Chain Selector (선택사항 - 기본값 제공)
BASE_SEPOLIA_CHAIN_SELECTOR=10344971235874465080
```

### 2. RPC URL 획득 방법

#### Alchemy 사용 (권장)
1. [Alchemy](https://www.alchemy.com/)에 회원가입
2. 새 앱 생성 (Ethereum Sepolia, Base Sepolia)
3. API Key를 URL에 추가

#### 기타 RPC 제공자
- **Infura**: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- **QuickNode**: 계정별 고유 URL 제공
- **공개 RPC**: 안정성이 떨어질 수 있음

### 3. Private Key 설정

⚠️ **보안 경고**: Private Key는 절대 공유하지 마세요!

```bash
# MetaMask에서 Private Key 추출
# 1. MetaMask 열기
# 2. 계정 메뉴 → 계정 세부 정보 → 개인 키 내보내기
# 3. 비밀번호 입력 후 키 복사

# Hardhat 개발용 계정 (테스트 전용)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 4. 스마트 컨트랙트 주소

실제 배포된 컨트랙트 주소로 교체해야 합니다:

```bash
# 예시 주소들 (실제 주소로 교체 필요)
VAULT_ADDRESS=0x742d35Cc6634C0532925a3b8D7389b4E6F1f4000
VAULT_SENDER_ADDRESS=0x742d35Cc6634C0532925a3b8D7389b4E6F1f4001
VAULT_RECEIVER_ADDRESS=0x742d35Cc6634C0532925a3b8D7389b4E6F1f4002
KKCOIN_ADDRESS=0x742d35Cc6634C0532925a3b8D7389b4E6F1f4003
```

## 🎮 사용법

### 기본 명령어

```bash
# 담보 예치
"1 ETH 예치해줘"
"0.5 이더 담보로 넣어줘"

# 대출 신청
"100 KKCoin 빌려줘"
"50 KKC 대출해줘"

# 상태 확인
"내 대출 상태 확인해줘"
"현재 담보 비율 알려줘"

# 대출 상환
"50 KKCoin 상환해줘"
"100 KKC 갚아줘"

# 담보 인출
"0.2 ETH 인출해줘"
"담보 빼줘"
```

### 사용 시나리오

1. **첫 대출**:
   ```
   사용자: "1 ETH 예치해줘"
   봇: ✅ 1 ETH 담보 예치 완료! 최대 10,000 KKCoin 대출 가능
   
   사용자: "5000 KKCoin 빌려줘"
   봇: 🚀 대출 요청 전송 완료! CCIP로 처리 중...
   ```

2. **상태 확인**:
   ```
   사용자: "내 상태 확인해줘"
   봇: 📊 담보: 1 ETH, 부채: 5000 KKCoin, 담보비율: 200% 🟢
   ```

3. **상환 및 인출**:
   ```
   사용자: "5000 KKCoin 상환해줘"
   봇: ✅ 상환 완료! 모든 부채가 상환되었습니다.
   
   사용자: "1 ETH 인출해줘"
   봇: ✅ 담보 인출 완료! 1 ETH가 지갑으로 전송되었습니다.
   ```

## 🔧 시스템 구성

### 아키텍처
```
Ethereum Sepolia          Base Sepolia
┌─────────────────┐      ┌─────────────────┐
│     Vault       │      │   KKCoin        │
│ (담보 관리)       │ CCIP │ (토큰 발행)       │
│                 │◄────►│                 │
│  VaultSender    │      │ VaultReceiver   │
└─────────────────┘      └─────────────────┘
```

### 토큰 경제학
- **담보 비율**: 최소 150% (권장 200% 이상)
- **환율**: 1 ETH = 10,000 KKCoin
- **청산 임계값**: 담보 비율 150% 미만
- **수수료**: 가스비 외 추가 수수료 없음

## 🚨 주의사항

1. **테스트넷 사용**: 현재 Sepolia 테스트넷에서만 동작
2. **가스비 준비**: 트랜잭션 실행을 위한 ETH 필요
3. **CCIP 지연시간**: 크로스체인 메시지는 5-10분 소요
4. **Private Key 보안**: 절대 공유하지 말 것
5. **담보 비율 관리**: 150% 미만 시 청산 위험

## 🐛 문제 해결

### 자주 발생하는 오류

1. **"잔액이 부족합니다"**
   - ETH 잔액 확인
   - 가스비용 고려

2. **"담보가 부족합니다"**
   - 더 많은 ETH 예치 필요
   - 대출 금액 줄이기

3. **"네트워크 연결 오류"**
   - RPC URL 확인
   - 인터넷 연결 상태 점검

4. **"트랜잭션 실패"**
   - 가스비 설정 확인
   - 네트워크 혼잡도 확인

### 로그 확인
```bash
# ElizaOS 실행 시 로그 확인
bun run dev --character characters/lootpang.json

# 상세 디버그 로그
DEBUG=* bun run dev --character characters/lootpang.json
```

## 📞 지원

문제가 발생하면 다음을 확인해주세요:
1. 환경 변수 설정
2. 스마트 컨트랙트 주소
3. RPC 연결 상태
4. 가스비 잔액

추가 도움이 필요하면 GitHub Issues에 문의해주세요. 