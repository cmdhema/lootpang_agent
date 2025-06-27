import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const depositCollateralAction: Action = {
    name: "DEPOSIT_COLLATERAL",
    similes: [
        "예치", "담보넣기", "ETH예치", "담보예치",
        "이더예치", "담보로넣기", "예치해줘", "담보넣어줘"
    ],
    description: "ETH를 Sepolia 네트워크의 Vault에 담보로 예치합니다",
    examples: [
        [
            {
                name: "user",
                content: {
                    text: "1 ETH 예치해줘"
                }
            },
            {
                name: "assistant",
                content: {
                    text: "Sepolia 네트워크에 1 ETH를 담보로 예치하겠습니다.",
                    action: "DEPOSIT_COLLATERAL"
                }
            }
        ]
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        const depositKeywords = ['예치', '담보', 'eth', '이더', 'deposit'];
        const amountPattern = /(\d+(?:\.\d+)?)\s*eth/i;
        
        return depositKeywords.some(keyword => text.includes(keyword)) && amountPattern.test(text);
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] DEPOSIT_COLLATERAL handler started");
            console.log("[DEBUG] Message content:", message.content?.text);

            // Extract ETH amount from message
            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found");
            }

            const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*eth/i);
            if (!amountMatch) {
                throw new Error("Could not extract ETH amount from message");
            }

            const ethAmount = parseFloat(amountMatch[1]);
            console.log("[DEBUG] Extracted ETH amount:", ethAmount);

            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Check current ETH balance
            const ethBalance = await blockchainService.getEthBalance(userAddress);
            console.log("[DEBUG] Current ETH balance:", ethBalance);

            if (parseFloat(ethBalance) < ethAmount) {
                if (callback) {
                    callback({
                        text: `❌ **ETH 잔액이 부족합니다!**\n\n` +
                              `💰 **현재 잔액**: ${ethBalance} ETH\n` +
                              `📤 **예치 요청**: ${ethAmount} ETH\n` +
                              `⚠️ **부족 금액**: ${(ethAmount - parseFloat(ethBalance)).toFixed(4)} ETH\n\n` +
                              `💡 먼저 Sepolia 테스트넷에서 ETH를 받으세요.`,
                        action: "INSUFFICIENT_ETH_BALANCE"
                    });
                }
                return false;
            }

            // Get Sepolia Vault contract (담보 관리용)
            console.log("[DEBUG] Getting Sepolia vault contract for collateral deposit...");
            const sepoliaVault = blockchainService.getSepoliaVaultContract();

            // Convert ETH amount to wei
            const ethAmountWei = ethers.parseEther(ethAmount.toString());
            console.log("[DEBUG] ETH amount in wei:", ethAmountWei.toString());

            // Execute collateral deposit on Sepolia
            console.log("[DEBUG] Executing collateral deposit on Sepolia...");
            const tx = await sepoliaVault.depositCollateral({
                value: ethAmountWei
            });

            console.log("[DEBUG] Transaction sent:", tx.hash);
            console.log("[DEBUG] Waiting for transaction confirmation...");

            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log("[DEBUG] Transaction confirmed in block:", receipt.blockNumber);

            if (receipt.status === 0) {
                throw new Error("트랜잭션이 실패했습니다");
            }

            // Check updated collateral status
            console.log("[DEBUG] Checking updated collateral status...");
            const newCollateral = await sepoliaVault.getCollateral(userAddress);
            const maxLoanAmount = await sepoliaVault.getMaxLoanAmount(userAddress);

            console.log("[DEBUG] New collateral:", ethers.formatEther(newCollateral), "ETH");
            console.log("[DEBUG] Max loan amount:", ethers.formatUnits(maxLoanAmount, 18), "KKCoin");

            if (callback) {
                callback({
                    text: `✅ **Sepolia 담보 예치 성공!**\n\n` +
                          `💰 **예치 금액**: ${ethAmount} ETH\n` +
                          `🏦 **총 담보 (Sepolia)**: ${ethers.formatEther(newCollateral)} ETH\n` +
                          `📊 **최대 대출 가능**: ${ethers.formatUnits(maxLoanAmount, 18)} KKCoin\n` +
                          `🔗 **트랜잭션**: ${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 8)}\n` +
                          `⛓️ **네트워크**: Ethereum Sepolia\n\n` +
                          `💡 이제 최대 ${ethers.formatUnits(maxLoanAmount, 18)} KKCoin을 빌릴 수 있습니다!\n` +
                          `🚀 대출 요청: "${ethers.formatUnits(maxLoanAmount, 18)} KKCoin 빌려줘"`,
                    action: "DEPOSIT_COLLATERAL_SUCCESS"
                });
            }

            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Deposit collateral error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');

            if (callback) {
                callback({
                    text: `❌ **담보 예치 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 **해결 방법**:\n` +
                          `1. Sepolia 테스트넷 ETH 잔액 확인\n` +
                          `2. 네트워크 연결 상태 확인\n` +
                          `3. 가스비 확인\n\n` +
                          `🔄 다시 시도해보세요.`,
                    action: "DEPOSIT_COLLATERAL_FAILED"
                });
            }
            return false;
        }
    }
}; 