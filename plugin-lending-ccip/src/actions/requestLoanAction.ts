import { Action, Content, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";

export const requestLoanAction: Action = {
    name: "request-loan",
    description: "KKCoin 대출을 요청하고 서명에 필요한 데이터를 생성합니다.",
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) {
            return false;
        }
        return (text.includes('borrow') || text.includes('빌려줘') || text.includes('대출')) && 
               text.includes('kkcoin') && 
               /\d+/.test(text);
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback,
        _responses?: Memory[]
    ) => {
        console.log("[DEBUG] ========== REQUEST_LOAN HANDLER START (SIMPLE CALLBACK) ==========");
        const ETH_TO_KKC_RATE = 10000;
        const COLLATERAL_RATIO = 1.5;
        
        try {
            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found.");
            }
            
            const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
            if (!amountMatch) {
                throw new Error("Loan amount not found in the message.");
            }

            const kkcAmount = parseFloat(amountMatch[1]);
            const kkcAmountInWei = ethers.parseUnits(kkcAmount.toString(), 18);

            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();

            const sepoliaVault = blockchainService.getSepoliaVaultContractReadOnly();
            const baseVault = blockchainService.getBaseVaultContractReadOnly();

            const userCollateralInWei = await sepoliaVault.getCollateral(userAddress);
            const userDebtInWei = await baseVault.getDebt(userAddress);
            
            const userCollateralInEth = parseFloat(ethers.formatUnits(userCollateralInWei, 18));
            
            const userCollateralInKkcValue = userCollateralInWei * BigInt(ETH_TO_KKC_RATE);
            const totalDebtInWei = userDebtInWei + kkcAmountInWei;
            const totalRequiredCollateralInKkcValue = (totalDebtInWei * BigInt(Math.floor(COLLATERAL_RATIO * 100))) / BigInt(100);

            if (userCollateralInKkcValue < totalRequiredCollateralInKkcValue) {
                const deficitInKkcValue = totalRequiredCollateralInKkcValue - userCollateralInKkcValue;
                const additionalNeededInWei = deficitInKkcValue / BigInt(ETH_TO_KKC_RATE);
                const additionalNeededInEth = parseFloat(ethers.formatUnits(additionalNeededInWei, 18));
                
                const maxLoanableKkcInWei = (userCollateralInKkcValue * BigInt(100) / BigInt(Math.floor(COLLATERAL_RATIO * 100))) - userDebtInWei;
                const maxLoanAmountInKkc = parseFloat(ethers.formatUnits(maxLoanableKkcInWei > 0n ? maxLoanableKkcInWei : 0n, 18));

                if (callback) {
                    callback({
                        roomId: message.roomId,
                        text: `❌ **담보가 부족합니다!**\n\n` +
                              `🎯 **대출 요청**: ${kkcAmount} KKCoin\n` +
                              `💰 **현재 담보**: ${userCollateralInEth.toFixed(4)} ETH\n` +
                              `🔄 **최대 대출 가능**: ${maxLoanAmountInKkc.toFixed(4)} KKCoin\n` +
                              `⚠️ **추가 필요**: 약 ${additionalNeededInEth.toFixed(4)} ETH\n\n` +
                              `💡 "${additionalNeededInEth.toFixed(4)} ETH 예치해줘"라고 말해주세요!`,
                    });
                }
                console.log("[DEBUG] Insufficient collateral - returning");
                return;
            }

            const userNonce = await baseVault.nonces(userAddress);
            const deadline = Math.floor(Date.now() / 1000) + 3600; 

            const baseVaultAddress = await baseVault.getAddress();
            const chainId = await blockchainService.getBaseChainId();
            const domain = {
                name: 'VaultSender',
                version: '1',
                chainId: chainId.toString(),
                verifyingContract: baseVaultAddress,
            };
    
            const types = {
                BorrowPermit: [
                    { name: "user", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };
    
            const value = {
                user: userAddress,
                amount: kkcAmountInWei,
                nonce: userNonce,
                deadline: deadline,
            };

            const serializableValue = {
                user: value.user,
                amount: value.amount.toString(),
                nonce: value.nonce.toString(),
                deadline: value.deadline
            };
            const signatureData = { domain, types, value: serializableValue };

            const responseText = `🔐 **대출 승인을 위해 서명이 필요합니다**\n\n` +
                               `💳 **대출 금액**: ${kkcAmount} KKCoin\n` +
                               `💰 **현재 담보**: ${userCollateralInEth.toFixed(4)} ETH\n\n` +
                               `✅ **지갑에서 서명을 진행해주세요.**`;

            const contentWithSignature = `${responseText}\n\n<!-- SIGNATURE_DATA:${JSON.stringify(signatureData)} -->`;

            // ElizaOS 표준 callback 사용 (Content 형식)
            const responseContent: Content = {
                text: contentWithSignature,
                actions: ["AWAITING_SIGNATURE"],
                source: message.content?.source || "direct",
                metadata: {
                    signatureData: signatureData,
                    amount: kkcAmount,
                    collateral: userCollateralInEth.toFixed(4)
                }
            };

            if (callback) {
                console.log("[DEBUG] Calling callback with proper Content format");
                await callback(responseContent);
            }
            
            console.log("[DEBUG] ========== REQUEST_LOAN HANDLER SUCCESS ==========");
            return true;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("[ERROR] request-loan handler failed:", error);
            
            const errorContent: Content = {
                text: `❌ **대출 요청 실패**: ${errorMessage}`,
                actions: ["REQUEST_LOAN_FAILED"],
                source: message.content?.source || "direct"
            };

            if (callback) {
                console.log("[DEBUG] Calling callback with error content");
                await callback(errorContent);
            }
            
            console.log("[DEBUG] ========== REQUEST_LOAN HANDLER FAILED ==========");
            return false;
        }
    }
};