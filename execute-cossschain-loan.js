const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    const { network: { name: networkName } } = require("hardhat");
    const [ownerSigner] = await ethers.getSigners();
    const provider = ethers.provider;

    // test user for signing
    const testUserPrivateKey = process.env.TEST_USER_PRIVATE_KEY;
    if (!testUserPrivateKey) {
        throw new Error("TEST_USER_PRIVATE_KEY is not set in .env file");
    }
    const testUserSigner = new ethers.Wallet(testUserPrivateKey, provider);

    console.log("🚀 크로스체인 대출 실행 테스트 시작");

    // .env 파일에서 컨트랙트 주소들 불러오기
    const vaultSepoliaAddress = process.env.SEPOLIA_VAULT_CONTRACT;
    const vaultSenderAddress = process.env.SEPOLIA_VAULT_SENDER_CONTRACT;
    const vaultBaseSepoliaAddress = process.env.BASESEPOLIA_VAULT_CONTRACT;
    const vaultReceiverAddress = process.env.BASESEPOLIA_VAULT_RECEIVER_CONTRACT;
    const kkcoinAddress = process.env.BASESEPOLIA_KKCOIN_ADDRESS;

    // 주소들이 .env 파일에 설정되었는지 확인
    if (!vaultSepoliaAddress || !vaultSenderAddress || !vaultBaseSepoliaAddress || !vaultReceiverAddress || !kkcoinAddress) {
        console.error("❌ .env 파일에 필요한 컨트랙트 주소들이 설정되지 않았습니다.");
        console.error("필요한 변수: SEPOLIA_VAULT_CONTRACT, SEPOLIA_VAULT_SENDER_CONTRACT, BASESEPOLIA_VAULT_CONTRACT, BASESEPOLIA_VAULT_RECEIVER_CONTRACT, BASESEPOLIA_KKCOIN_ADDRESS");
        return;
    }

    console.log("✅ .env 파일에서 주소 로드 완료:");
    console.log(`  - Sepolia Vault: ${vaultSepoliaAddress}`);
    console.log(`  - Vault Sender: ${vaultSenderAddress}`);
    console.log(`  - Base Vault: ${vaultBaseSepoliaAddress}`);
    console.log(`  - Vault Receiver: ${vaultReceiverAddress}`);
    console.log(`  - KKCoin: ${kkcoinAddress}`);
    
    // 체인 셀렉터
    const BASE_CHAIN_SELECTOR = "10344971235874465080"; // Base Sepolia
    
    // 대출 금액 (10 KKCoin)
    const LOAN_AMOUNT = ethers.parseEther("10");
    
    console.log(`👤 Owner (Sepolia): ${ownerSigner.address}`);
    console.log(`👤 Test User: ${testUserSigner.address}`);
    
    try {
        const baseProvider = new ethers.JsonRpcProvider(process.env.BASESEPOLIA_RPC_URL);
        const basePrivateKey = process.env.BASESEPOLIA_PRIVATE_KEY;
        if (!basePrivateKey) {
            throw new Error("BASESEPOLIA_PRIVATE_KEY is not set in .env file");
        }
        const baseOwnerSigner = new ethers.Wallet(basePrivateKey, baseProvider);
        console.log(`👤 Owner (Base Sepolia): ${baseOwnerSigner.address}`);

        const sepoliaVault = await ethers.getContractAt("Vault", vaultSepoliaAddress, ownerSigner);
        const vaultSender = await ethers.getContractAt("VaultSender", vaultSenderAddress, ownerSigner);
        const baseVault = await ethers.getContractAt("Vault", vaultBaseSepoliaAddress, baseOwnerSigner);
        
        const userCollateral = await sepoliaVault.getCollateral(testUserSigner.address);
        const userDebt = await baseVault.getDebt(testUserSigner.address);
        
        console.log(`💰 User Collateral: ${ethers.formatEther(userCollateral)} ETH`);
        console.log(`💸 User Debt: ${ethers.formatEther(userDebt)} KKC`);
        
        if (userCollateral === 0n) {
            console.log("❌ 담보가 없습니다. 먼저 담보를 예치하세요.");
            return;
        }
        
        const userNonce = await baseVault.nonces(testUserSigner.address);
        console.log(`🔢 User Nonce: ${userNonce}`);
        
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1시간 후 만료
        
        const domain = {
            name: "VaultLending",
            version: "1",
            chainId: 84532, // Base Sepolia
            verifyingContract: vaultBaseSepoliaAddress
        };
        
        const types = {
            LoanRequest: [
                { name: "user", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ]
        };
        
        const value = {
            user: testUserSigner.address,
            amount: LOAN_AMOUNT,
            nonce: userNonce,
            deadline: deadline
        };
        
        console.log("✍️ EIP-712 서명 생성 중...");
        const signature = await testUserSigner.signTypedData(domain, types, value);
        console.log(`📝 Signature: ${signature.substring(0, 42)}...`);
        
        console.log("🚀 크로스체인 대출 요청 전송 중...");
        
        const tx = await vaultSender.sendLendRequestWithSignature(
            BASE_CHAIN_SELECTOR,
            vaultReceiverAddress,
            testUserSigner.address,
            LOAN_AMOUNT,
            userNonce,
            deadline,
            signature
        );
        
        console.log(`📤 Transaction Hash: ${tx.hash}`);
        console.log(`⏳ 트랜잭션 확인 중...`);
        
        const receipt = await tx.wait();
        console.log(`✅ 트랜잭션 확인됨! Block: ${receipt.blockNumber}`);
        
        // CCIP Message ID 찾기
        const ccipSendRequestedTopic = "0x423722a865cbc7772643a0e4a7a8409384723c015b634ea819662b607062208a"; // keccak256("CCIPSendRequested(bytes32)")
        const log = receipt.logs.find(log => log.topics[0] === ccipSendRequestedTopic);
        
        console.log("🎉 크로스체인 대출 요청이 성공적으로 전송되었습니다!");

        if (log) {
            const messageId = log.topics[1];
            console.log(`✉️ CCIP Message ID: ${messageId}`);
            console.log(`🔗 CCIP Explorer에서 추적: https://ccip.chain.link/msg/${messageId}`);
        } else {
            console.log("Could not find CCIP MessageId in the transaction logs.");
        }

        console.log("⏰ Base Sepolia에서 대출 실행까지 몇 분 정도 소요될 수 있습니다.");
        
    } catch (error) {
        console.error("❌ 크로스체인 대출 실행 실패:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});