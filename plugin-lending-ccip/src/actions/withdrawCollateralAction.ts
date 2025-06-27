import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const withdrawCollateralAction: Action = {
    name: "WITHDRAW_COLLATERAL",
    similes: [
        "인출", "담보인출", "ETH인출", "담보빼기",
        "이더인출", "담보회수", "인출해줘", "빼줘"
    ],
    description: "Sepolia 네트워크의 Vault에서 예치된 ETH 담보를 인출합니다",
    examples: [
        [
            {
                name: "user",
                content: {
                    text: "1 ETH 인출해줘"
                }
            },
            {
                name: "assistant",
                content: {
                    text: "Sepolia 네트워크에서 1 ETH 담보를 인출하겠습니다.",
                    action: "WITHDRAW_COLLATERAL"
                }
            }
        ]
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        const withdrawKeywords = ['인출', '빼', '회수', '담보인출', 'withdraw'];
        const amountPattern = /(\d+(?:\.\d+)?)\s*eth/i;
        const fullWithdrawPattern = /(전체|모두|다|all)/i;
        
        return withdrawKeywords.some(keyword => text.includes(keyword)) && 
               (amountPattern.test(text) || fullWithdrawPattern.test(text));
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] WITHDRAW_COLLATERAL handler started");
            console.log("[DEBUG] Message content:", message.content?.text);

            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found");
            }

            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Get Sepolia Vault contract (담보 관리용)
            console.log("[DEBUG] Getting Sepolia vault contract for collateral withdrawal...");
            const sepoliaVault = blockchainService.getSepoliaVaultContract();

            // Check current collateral and loan status
            console.log("[DEBUG] Checking current collateral and loan status...");
            const [collateral, currentLoan, collateralRatio] = await Promise.all([
                sepoliaVault.getCollateral(userAddress),
                sepoliaVault.getDebt(userAddress),
                sepoliaVault.getCollateralRatio(userAddress)
            ]);

            const collateralAmount = parseFloat(ethers.formatEther(collateral));
            const loanAmount = parseFloat(ethers.formatUnits(currentLoan, 18));

            console.log("[DEBUG] Current collateral:", collateralAmount, "ETH");
            console.log("[DEBUG] Current loan:", loanAmount, "KKCoin");
            console.log("[DEBUG] Collateral ratio:", Number(collateralRatio), "%");

            // Check if there's collateral to withdraw
            if (collateralAmount === 0) {
                if (callback) {
                    callback({
                        text: `ℹ️ **인출할 담보가 없습니다**\n\n` +
                              `💡 현재 Sepolia에 예치된 담보가 0 ETH입니다.\n` +
                              `먼저 담보를 예치해주세요: "1 ETH 예치해줘"`,
                        action: "NO_COLLATERAL_TO_WITHDRAW"
                    });
                }
                return false;
            }

            // Check if there's outstanding loan
            if (loanAmount > 0) {
                if (callback) {
                    callback({
                        text: `❌ **대출이 있어 담보를 인출할 수 없습니다**\n\n` +
                              `🏦 **현재 담보 (Sepolia)**: ${collateralAmount} ETH\n` +
                              `💳 **현재 대출**: ${loanAmount} KKCoin\n` +
                              `📊 **담보 비율**: ${(Number(collateralRatio) / 100).toFixed(1)}%\n\n` +
                              `💡 먼저 모든 대출을 상환해주세요:\n` +
                              `"${loanAmount} KKCoin 상환해줘" 또는 "전체 상환해줘"`,
                        action: "OUTSTANDING_LOAN_EXISTS"
                    });
                }
                return false;
            }

            // Determine withdrawal amount
            let withdrawAmount = 0;
            const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*eth/i);
            
            if (amountMatch) {
                withdrawAmount = parseFloat(amountMatch[1]);
            } else if (/(전체|모두|다|all)/i.test(text)) {
                withdrawAmount = collateralAmount;
            } else {
                throw new Error("인출할 금액을 명시해주세요 (예: '1 ETH 인출' 또는 '전체 인출')");
            }

            console.log("[DEBUG] Requested withdrawal amount:", withdrawAmount, "ETH");

            // Adjust withdrawal amount if it exceeds available collateral
            if (withdrawAmount > collateralAmount) {
                withdrawAmount = collateralAmount;
                console.log("[DEBUG] Adjusted withdrawal amount to available collateral:", withdrawAmount, "ETH");
            }

            // Convert ETH amount to wei
            const withdrawAmountWei = ethers.parseEther(withdrawAmount.toString());
            console.log("[DEBUG] Withdrawal amount in wei:", withdrawAmountWei.toString());

            // Execute collateral withdrawal on Sepolia
            console.log("[DEBUG] Executing collateral withdrawal on Sepolia...");
            const tx = await sepoliaVault.withdrawCollateral(withdrawAmountWei);

            console.log("[DEBUG] Transaction sent:", tx.hash);
            console.log("[DEBUG] Waiting for transaction confirmation...");

            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log("[DEBUG] Transaction confirmed in block:", receipt.blockNumber);

            if (receipt.status === 0) {
                throw new Error("트랜잭션이 실패했습니다");
            }

            // Check updated status
            console.log("[DEBUG] Checking updated status...");
            const [newCollateral, newEthBalance] = await Promise.all([
                sepoliaVault.getCollateral(userAddress),
                blockchainService.getEthBalance(userAddress)
            ]);

            const remainingCollateral = parseFloat(ethers.formatEther(newCollateral));
            const isFullWithdraw = remainingCollateral === 0;

            console.log("[DEBUG] Remaining collateral:", remainingCollateral, "ETH");
            console.log("[DEBUG] New ETH balance:", newEthBalance, "ETH");
            console.log("[DEBUG] Is full withdrawal:", isFullWithdraw);

            if (callback) {
                callback({
                    text: `✅ **Sepolia 담보 인출 성공!**\n\n` +
                          `💰 **인출 금액**: ${withdrawAmount} ETH\n` +
                          `🏦 **남은 담보 (Sepolia)**: ${remainingCollateral} ETH\n` +
                          `💳 **지갑 잔액**: ${newEthBalance} ETH\n` +
                          `🔗 **트랜잭션**: ${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 8)}\n` +
                          `⛓️ **네트워크**: Ethereum Sepolia\n\n` +
                          `${isFullWithdraw ?
                              '🎉 **모든 담보를 성공적으로 인출했습니다!**\n💡 이제 새로운 대출을 위해 다시 담보를 예치할 수 있습니다.' :
                              '💡 남은 담보로 추가 대출을 받거나 더 많은 담보를 인출할 수 있습니다.'
                          }`,
                    action: "WITHDRAW_COLLATERAL_SUCCESS"
                });
            }

            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Withdraw collateral error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');

            if (callback) {
                callback({
                    text: `❌ **담보 인출 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 **해결 방법**:\n` +
                          `1. 모든 대출이 상환되었는지 확인\n` +
                          `2. 충분한 담보가 예치되어 있는지 확인\n` +
                          `3. Sepolia 네트워크 연결 상태 확인\n` +
                          `4. 가스비 확인\n\n` +
                          `🔄 다시 시도해보세요.`,
                    action: "WITHDRAW_COLLATERAL_FAILED"
                });
            }
            return false;
        }
    }
}; 