import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const repayLoanAction: Action = {
    name: "REPAY_LOAN",
    similes: [
        "상환", "갚기", "대출상환", "빚갚기",
        "상환해줘", "갚아줘", "대출갚기", "리페이"
    ],
    description: "Base Sepolia 네트워크에서 KKCoin 대출을 상환합니다",
    examples: [
        [
            {
                name: "user",
                content: {
                    text: "100 KKCoin 상환해줘"
                }
            },
            {
                name: "assistant",
                content: {
                    text: "Base Sepolia 네트워크에서 100 KKCoin을 상환하겠습니다.",
                    action: "REPAY_LOAN"
                }
            }
        ]
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        const repayKeywords = ['상환', '갚', '리페이', 'repay'];
        const amountPattern = /(\d+(?:\.\d+)?)\s*(kkcoin|kkc)/i;
        const fullRepayPattern = /(전체|모두|다|all)/i;
        
        return repayKeywords.some(keyword => text.includes(keyword)) && 
               (amountPattern.test(text) || fullRepayPattern.test(text));
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] REPAY_LOAN handler started");
            console.log("[DEBUG] Message content:", message.content?.text);

            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found");
            }

            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Get Base Sepolia Vault contract (대출 실행용)
            console.log("[DEBUG] Getting Base Sepolia vault contract for loan repayment...");
            const baseVault = blockchainService.getBaseVaultContract();

            // Check current loan status
            console.log("[DEBUG] Checking current loan status...");
            const currentLoan = await baseVault.getDebt(userAddress);
            const currentLoanAmount = parseFloat(ethers.formatUnits(currentLoan, 18));

            console.log("[DEBUG] Current loan amount:", currentLoanAmount, "KKCoin");

            if (currentLoanAmount === 0) {
                if (callback) {
                    callback({
                        text: `ℹ️ **상환할 대출이 없습니다**\n\n` +
                              `💡 현재 Base Sepolia에서 대출 잔액이 0입니다.\n` +
                              `새로운 대출을 원하시면 "100 KKCoin 빌려줘"라고 말해주세요.`,
                        action: "NO_LOAN_TO_REPAY"
                    });
                }
                return false;
            }

            // Determine repayment amount
            let repayAmount = 0;
            const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(kkcoin|kkc)/i);
            
            if (amountMatch) {
                repayAmount = parseFloat(amountMatch[1]);
            } else if (/(전체|모두|다|all)/i.test(text)) {
                repayAmount = currentLoanAmount;
            } else {
                throw new Error("상환할 금액을 명시해주세요 (예: '100 KKCoin 상환' 또는 '전체 상환')");
            }

            console.log("[DEBUG] Requested repayment amount:", repayAmount, "KKCoin");

            // Adjust repayment amount if it exceeds current loan
            if (repayAmount > currentLoanAmount) {
                repayAmount = currentLoanAmount;
                console.log("[DEBUG] Adjusted repayment amount to current loan:", repayAmount, "KKCoin");
            }

            // Check KKCoin balance (assuming KKCoin is on Base Sepolia)
            // Note: This would need to be implemented based on actual KKCoin contract
            console.log("[DEBUG] Checking KKCoin balance...");
            // For now, we'll assume the user has enough KKCoin
            // In a real implementation, you would check the KKCoin contract balance

            // Convert KKCoin amount to wei equivalent
            const repayAmountWei = ethers.parseUnits(repayAmount.toString(), 18);
            console.log("[DEBUG] Repayment amount in wei:", repayAmountWei.toString());

            // Execute loan repayment on Base Sepolia
            console.log("[DEBUG] Executing loan repayment on Base Sepolia...");
            const tx = await baseVault.repayLoan(repayAmountWei);

            console.log("[DEBUG] Transaction sent:", tx.hash);
            console.log("[DEBUG] Waiting for transaction confirmation...");

            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log("[DEBUG] Transaction confirmed in block:", receipt.blockNumber);

            if (receipt.status === 0) {
                throw new Error("트랜잭션이 실패했습니다");
            }

            // Check updated status
            console.log("[DEBUG] Checking updated loan status...");
            const [newLoanAmount, newCollateralRatio] = await Promise.all([
                baseVault.getDebt(userAddress),
                baseVault.getCollateralRatio(userAddress)
            ]);

            const remainingLoan = parseFloat(ethers.formatUnits(newLoanAmount, 18));
            const isFullRepay = remainingLoan === 0;

            console.log("[DEBUG] Remaining loan:", remainingLoan, "KKCoin");
            console.log("[DEBUG] New collateral ratio:", Number(newCollateralRatio), "%");
            console.log("[DEBUG] Is full repayment:", isFullRepay);

            if (callback) {
                callback({
                    text: `✅ **Base Sepolia 대출 상환 성공!**\n\n` +
                          `💰 **상환 금액**: ${repayAmount} KKCoin\n` +
                          `🏦 **남은 대출**: ${remainingLoan} KKCoin\n` +
                          `📊 **담보 비율**: ${newCollateralRatio > 0 ? (Number(newCollateralRatio) / 100).toFixed(1) + '%' : 'N/A'}\n` +
                          `🔗 **트랜잭션**: ${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 8)}\n` +
                          `⛓️ **네트워크**: Base Sepolia\n\n` +
                          `${isFullRepay ?
                              '🎉 **축하합니다! 모든 대출을 상환했습니다!**\n💡 이제 Sepolia에서 담보를 인출할 수 있습니다.' :
                              '💡 추가 상환이나 담보 관리를 계속하실 수 있습니다.'
                          }`,
                    action: "REPAY_LOAN_SUCCESS"
                });
            }

            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Repay loan error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');

            if (callback) {
                callback({
                    text: `❌ **대출 상환 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 **해결 방법**:\n` +
                          `1. 충분한 KKCoin 잔액 확인\n` +
                          `2. Base Sepolia 네트워크 연결 상태 확인\n` +
                          `3. 가스비 확인\n` +
                          `4. 대출 잔액 확인\n\n` +
                          `🔄 다시 시도해보세요.`,
                    action: "REPAY_LOAN_FAILED"
                });
            }
            return false;
        }
    }
}; 