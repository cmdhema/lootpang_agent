import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const requestLoanAction: Action = {
    name: "REQUEST_LOAN",
    similes: [
        "대출", "빌리기", "KKCoin빌리기", "대출신청",
        "케이케이코인빌리기", "빌려줘", "대출해줘", "론",
        "BORROW", "LOAN_REQUEST", "GET_LOAN", "REQUEST_LENDING", "BORROW_MONEY", "TAKE_LOAN"
    ],
    description: "KKCoin 대출을 요청합니다 (서명 필요)",
    examples: [
        [
            {
                name: "user",
                content: {
                    text: "100 KKCoin 빌려줘"
                }
            },
            {
                name: "assistant",
                content: {
                    text: "대출 요청을 처리하겠습니다. 보안을 위해 서명이 필요합니다.",
                    action: "REQUEST_LOAN"
                }
            }
        ]
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        const borrowKeywords = ['대출', '빌리기', '빌려줘', '대출해줘', 'borrow', 'loan', 'lend', 'lending', 'kkcoin', 'kkc'];
        const amountPattern = /(\d+(?:\.\d+)?)\s*(?:kkc|kkcoin|케이케이코인)/i;
        
        return borrowKeywords.some(keyword => text.includes(keyword)) && amountPattern.test(text);
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] REQUEST_LOAN handler started");
            console.log("[DEBUG] Message content:", message.content?.text);

            // Extract amount from message
            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found");
            }
            
            const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kkc|kkcoin|케이케이코인)/i);
            
            if (!amountMatch) {
                throw new Error("Could not extract loan amount from message");
            }

            const kkcAmount = parseFloat(amountMatch[1]);
            console.log("[DEBUG] Extracted KKC amount:", kkcAmount);

            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Get contracts from both networks
            console.log("[DEBUG] Getting vault contracts from both networks...");
            const sepoliaVault = blockchainService.getSepoliaVaultContractReadOnly(); // For collateral info
            const baseVault = blockchainService.getBaseVaultContractReadOnly(); // For nonce and debt

            // Check user's current status from both networks
            console.log("[DEBUG] Checking user collateral (Sepolia) and loan status (Base)...");
            const [userCollateral, maxLoanAmount] = await Promise.all([
                sepoliaVault.getCollateral(userAddress),      // Sepolia: 담보 정보
                sepoliaVault.getMaxLoanAmount(userAddress)    // Sepolia: 최대 대출 가능 금액
            ]);

            const [userDebt, userNonce] = await Promise.all([
                baseVault.getDebt(userAddress),               // Base: 현재 대출
                baseVault.nonces(userAddress)                 // Base: EIP-712 nonce
            ]);

            console.log("[DEBUG] User status:");
            console.log("  - Collateral (Sepolia):", ethers.formatEther(userCollateral), "ETH");
            console.log("  - Current debt (Base):", ethers.formatUnits(userDebt, 18), "KKCoin");
            console.log("  - Max loan amount (Sepolia):", ethers.formatUnits(maxLoanAmount, 18), "KKCoin");
            console.log("  - Nonce (Base):", userNonce.toString());

            // Check if user has sufficient collateral
            const maxLoanAmountFormatted = parseFloat(ethers.formatUnits(maxLoanAmount, 18));
            
            if (maxLoanAmountFormatted < kkcAmount) {
                const currentCollateralEth = ethers.formatEther(userCollateral);
                const additionalNeeded = ((kkcAmount - maxLoanAmountFormatted) * 1.5).toFixed(4); // Assuming 150% collateral ratio
                
                if (callback) {
                    callback({
                        text: `❌ **담보가 부족합니다!**\n\n` +
                              `🎯 **대출 요청**: ${kkcAmount} KKCoin\n` +
                              `💰 **현재 담보**: ${currentCollateralEth} ETH\n` +
                              `🔄 **최대 대출 가능**: ${maxLoanAmountFormatted} KKCoin\n` +
                              `⚠️ **추가 필요**: 약 ${additionalNeeded} ETH\n\n` +
                              `💡 먼저 "${additionalNeeded} ETH 예치해줘"라고 말해주세요!`,
                        action: "INSUFFICIENT_COLLATERAL"
                    });
                }
                return false;
            }

            // Generate signature data
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const nonce = Number(userNonce);
            
            const signatureData = {
                user: userAddress,
                amount: kkcAmount,
                nonce: nonce,
                deadline: deadline
            };

            console.log("[DEBUG] Signature data generated:");
            console.log("  - User:", signatureData.user);
            console.log("  - Amount:", signatureData.amount);
            console.log("  - Nonce:", signatureData.nonce);
            console.log("  - Deadline:", new Date(signatureData.deadline * 1000).toLocaleString());

            if (callback) {
                callback({
                    text: `🔐 **대출 승인을 위해 서명이 필요합니다**\n\n` +
                          `💳 **대출 금액**: ${kkcAmount} KKCoin\n` +
                          `📝 **서명 데이터**:\n` +
                          `• 사용자: ${userAddress}\n` +
                          `• 금액: ${kkcAmount} KKCoin\n` +
                          `• Nonce: ${nonce}\n` +
                          `• 만료시간: ${new Date(deadline * 1000).toLocaleString()}\n\n` +
                          `✅ **지갑에서 서명 후 "서명 완료 [서명값]"라고 말해주세요**\n\n` +
                          `⚠️ 서명은 1시간 후 만료됩니다.`,
                    action: "AWAITING_SIGNATURE",
                    metadata: { 
                        signatureData,
                        loanAmount: kkcAmount,
                        userAddress,
                        nonce,
                        deadline
                    }
                });
            }

            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Request loan error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
            
            if (callback) {
                callback({
                    text: `❌ **대출 요청 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 네트워크 상태를 확인하고 다시 시도해주세요.`,
                    action: "LOAN_REQUEST_FAILED"
                });
            }
            return false;
        }
    }
}; 