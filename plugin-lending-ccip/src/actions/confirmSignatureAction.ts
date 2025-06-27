import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";
import { BlockchainService } from "../utils/blockchain";
import { BASE_SEPOLIA_CHAIN_SELECTOR, VAULT_RECEIVER_ADDRESS } from "../config/constants";

export const confirmSignatureAction: Action = {
    name: "CONFIRM_SIGNATURE",
    similes: [
        "서명완료", "서명 완료", "signature", "signed",
        "서명했어", "서명했습니다", "완료"
    ],
    description: "서명된 대출 요청을 처리합니다",
    examples: [
        [
            {
                name: "user",
                content: {
                    text: "서명 완료 0x1234567890abcdef..."
                }
            },
            {
                name: "assistant",
                content: {
                    text: "서명을 확인하고 대출 요청을 처리하겠습니다.",
                    action: "CONFIRM_SIGNATURE"
                }
            }
        ]
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content?.text?.toLowerCase();
        if (!text) return false;
        
        return text.includes("서명") && 
               (text.includes("완료") || text.includes("0x"));
    },
    handler: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            console.log("[DEBUG] CONFIRM_SIGNATURE handler started");
            console.log("[DEBUG] Message content:", message.content?.text);

            // Extract signature from message
            const text = message.content?.text;
            if (!text) {
                throw new Error("No message text found");
            }

            const signatureMatch = text.match(/0x[a-fA-F0-9]{130}/);
            
            if (!signatureMatch) {
                if (callback) {
                    callback({
                        text: `❌ **유효한 서명을 찾을 수 없습니다**\n\n` +
                              `📝 서명은 "0x"로 시작하는 130자리 문자열이어야 합니다.\n` +
                              `예: 0x1234567890abcdef...\n\n` +
                              `💡 먼저 "100 KKCoin 빌려줘"라고 말해서 서명 요청을 받으세요.`,
                        action: "INVALID_SIGNATURE"
                    });
                }
                return false;
            }

            const signature = signatureMatch[0];
            console.log("[DEBUG] Extracted signature:", signature);

            // Initialize blockchain service
            const blockchainService = new BlockchainService();
            const userAddress = blockchainService.getWalletAddress();
            console.log("[DEBUG] User address:", userAddress);

            // Extract loan amount from message (try to get from text)
            let kkcAmount = 0;
            const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kkc|kkcoin|케이케이코인)/i);
            if (amountMatch) {
                kkcAmount = parseFloat(amountMatch[1]);
            } else {
                // Default amount if not specified (실제로는 이전 요청에서 가져와야 함)
                kkcAmount = 100;
            }
            console.log("[DEBUG] Loan amount:", kkcAmount);

            // Get current nonce from Base Sepolia vault contract
            const baseVault = blockchainService.getBaseVaultContractReadOnly();
            const userNonce = await baseVault.nonces(userAddress);
            const nonce = Number(userNonce);
            console.log("[DEBUG] Current nonce:", nonce);
            
            // Set deadline (1 hour from now)
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            console.log("[DEBUG] Deadline:", new Date(deadline * 1000).toLocaleString());

            // Get VaultSender contract and send signed request
            console.log("[DEBUG] Getting vault sender contract...");
            const vaultSender = blockchainService.getVaultSenderContract();
            
            console.log("[DEBUG] Sending signed lend request with parameters:");
            console.log("  - Destination Chain Selector:", BASE_SEPOLIA_CHAIN_SELECTOR);
            console.log("  - Receiver:", VAULT_RECEIVER_ADDRESS);
            console.log("  - User:", userAddress);
            console.log("  - Amount:", kkcAmount);
            console.log("  - Nonce:", nonce);
            console.log("  - Deadline:", deadline);
            console.log("  - Signature:", signature);

            const tx = await vaultSender.sendLendRequestWithSignature(
                BASE_SEPOLIA_CHAIN_SELECTOR,
                VAULT_RECEIVER_ADDRESS,
                userAddress,
                ethers.parseUnits(kkcAmount.toString(), 18), // Convert to wei
                nonce,
                deadline,
                signature
            );
            
            console.log("[DEBUG] Transaction sent:", tx.hash);
            console.log("[DEBUG] Waiting for transaction confirmation...");
            
            const receipt = await tx.wait();
            console.log("[DEBUG] Transaction confirmed in block:", receipt.blockNumber);
            
            if (receipt.status === 0) {
                throw new Error("서명된 대출 요청 전송이 실패했습니다");
            }

            if (callback) {
                callback({
                    text: `🚀 **서명된 대출 요청 전송 완료!**\n\n` +
                          `💳 **대출 금액**: ${kkcAmount} KKCoin\n` +
                          `🔐 **서명 검증**: ✅ 완료\n` +
                          `📊 **Nonce**: ${nonce}\n` +
                          `🔗 **트랜잭션**: ${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 8)}\n` +
                          `🌉 **경로**: Ethereum Sepolia → Base Sepolia\n\n` +
                          `⏳ **CCIP를 통해 안전하게 처리 중입니다...**\n` +
                          `💡 약 5-10분 후 Base Sepolia에서 KKCoin이 지급됩니다!\n\n` +
                          `🔍 **상태 확인**: "대출 상태 확인해줘"`,
                    action: "SIGNED_LOAN_REQUEST_SENT"
                });
            }

            return true;
            
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log("[DEBUG] Confirm signature error:", errorMessage);
            console.log("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
            
            if (callback) {
                callback({
                    text: `❌ **서명된 대출 요청 실패**\n\n` +
                          `🚫 **오류**: ${errorMessage}\n\n` +
                          `💡 **해결 방법**:\n` +
                          `1. 서명이 올바른지 확인 (0x로 시작하는 130자)\n` +
                          `2. 서명이 만료되지 않았는지 확인\n` +
                          `3. 네트워크 상태 확인\n\n` +
                          `🔄 다시 시도하려면 "100 KKCoin 빌려줘"부터 시작하세요.`,
                    action: "SIGNED_LOAN_REQUEST_FAILED"
                });
            }
            return false;
        }
    }
}; 