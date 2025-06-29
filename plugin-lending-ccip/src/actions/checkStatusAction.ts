import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const checkStatusAction: Action = {
    name: "check-status",
    description: "사용자의 현재 대출 상태와 담보 정보를 확인합니다.",
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        const statusKeywords = ['status', 'check', 'loan', 'debt', 'balance', 'current', '상태', '확인', '대출', '잔액'];
        return statusKeywords.some(keyword => text.includes(keyword));
    },
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] CHECK_STATUS handler started");
            
            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Get both vault contracts
            console.log("[DEBUG] Getting vault contracts from both networks...");
            const sepoliaVault = blockchainService.getSepoliaVaultContractReadOnly();
            const baseVault = blockchainService.getBaseVaultContractReadOnly();

            // Check status on both networks
            console.log("[DEBUG] Checking status on both networks...");
            
            // Sepolia Network (담보 관리)
            let sepoliaCollateral = ethers.parseEther("0");
            let sepoliaMaxLoan = ethers.parseEther("0");
            let sepoliaError: string | null = null;
            
            try {
                console.log("[DEBUG] Checking Sepolia vault status...");
                [sepoliaCollateral, sepoliaMaxLoan] = await Promise.all([
                    sepoliaVault.getCollateral(userAddress),
                    sepoliaVault.getMaxLoanAmount(userAddress)
                ]);
                console.log("[DEBUG] Sepolia collateral:", ethers.formatEther(sepoliaCollateral), "ETH");
                console.log("[DEBUG] Sepolia max loan:", ethers.formatUnits(sepoliaMaxLoan, 18), "KKCoin");
            } catch (error) {
                sepoliaError = error instanceof Error ? error.message : String(error);
                console.log("[DEBUG] Sepolia vault error:", sepoliaError);
            }

            // Base Sepolia Network (대출 실행)
            let baseDebt = ethers.parseEther("0");
            let baseCollateralRatio = 0;
            let baseError: string | null = null;
            
            try {
                console.log("[DEBUG] Checking Base Sepolia vault status...");
                [baseDebt, baseCollateralRatio] = await Promise.all([
                    baseVault.getDebt(userAddress),
                    baseVault.getCollateralRatio(userAddress)
                ]);
                console.log("[DEBUG] Base debt:", ethers.formatUnits(baseDebt, 18), "KKCoin");
                console.log("[DEBUG] Base collateral ratio:", Number(baseCollateralRatio), "%");
            } catch (error) {
                baseError = error instanceof Error ? error.message : String(error);
                console.log("[DEBUG] Base vault error:", baseError);
            }

            // Check ETH balance
            let ethBalance = "0";
            try {
                ethBalance = await blockchainService.getEthBalance(userAddress);
                console.log("[DEBUG] ETH balance:", ethBalance, "ETH");
            } catch (error) {
                console.log("[DEBUG] ETH balance check error:", error);
            }

            // Format response
            const sepoliaCollateralFormatted = ethers.formatEther(sepoliaCollateral);
            const sepoliaMaxLoanFormatted = ethers.formatUnits(sepoliaMaxLoan, 18);
            const baseDebtFormatted = ethers.formatUnits(baseDebt, 18);
            
            let statusText = `📊 **CCIP 크로스체인 대출 상태**\n\n`;
            
            // Network status
            statusText += `⛓️ **네트워크별 상태**\n\n`;
            
            // Sepolia Network Status
            statusText += `🔵 **Ethereum Sepolia (담보 관리)**\n`;
            if (sepoliaError) {
                statusText += `❌ 연결 오류: ${sepoliaError}\n`;
            } else {
                statusText += `🏦 담보: ${sepoliaCollateralFormatted} ETH\n`;
                statusText += `📈 최대 대출 가능: ${sepoliaMaxLoanFormatted} KKCoin\n`;
            }
            statusText += `💳 ETH 잔액: ${ethBalance} ETH\n\n`;
            
            // Base Sepolia Network Status
            statusText += `🟡 **Base Sepolia (대출 실행)**\n`;
            if (baseError) {
                statusText += `❌ 연결 오류: ${baseError}\n`;
            } else {
                statusText += `💰 현재 대출: ${baseDebtFormatted} KKCoin\n`;
                statusText += `📊 담보 비율: ${baseCollateralRatio > 0 ? (Number(baseCollateralRatio) / 100).toFixed(1) + '%' : 'N/A'}\n`;
            }
            statusText += `\n`;
            
            // Overall status
            statusText += `👤 **사용자 정보**\n`;
            statusText += `🔗 주소: ${userAddress}\n\n`;
            
            // Recommendations
            const hasCollateral = parseFloat(sepoliaCollateralFormatted) > 0;
            const hasDebt = parseFloat(baseDebtFormatted) > 0;
            
            statusText += `💡 **추천 액션**\n`;
            if (!hasCollateral && !hasDebt) {
                statusText += `• 먼저 Sepolia에 ETH를 예치하세요: "1 ETH 예치해줘"\n`;
            } else if (hasCollateral && !hasDebt) {
                statusText += `• 대출을 받을 수 있습니다: "${sepoliaMaxLoanFormatted} KKCoin 빌려줘"\n`;
            } else if (hasDebt) {
                statusText += `• 대출 상환을 고려해보세요: "${baseDebtFormatted} KKCoin 상환해줘"\n`;
                if (hasCollateral) {
                    statusText += `• 대출 상환 후 담보를 인출할 수 있습니다\n`;
                }
            }

            if (callback) {
                callback({
                    text: statusText,
                    action: "CHECK_STATUS_SUCCESS"
                });
            }

            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Check status error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
            
            if (callback) {
                callback({
                    text: `❌ **상태 확인 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 **해결 방법**:\n` +
                          `1. 네트워크 연결 상태 확인\n` +
                          `2. 환경변수 설정 확인\n` +
                          `3. 컨트랙트 주소 확인\n\n` +
                          `🔄 다시 시도해보세요.`,
                    action: "CHECK_STATUS_FAILED"
                });
            }
            return false;
        }
    }
};