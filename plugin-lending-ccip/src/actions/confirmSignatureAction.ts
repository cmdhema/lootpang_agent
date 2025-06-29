import { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";

export const confirmSignatureAction: Action = {
    name: "confirm-signature",
    description: "사용자가 제출한 서명을 검증하고 대출 트랜잭션을 실행합니다.",
    validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        const text = message.content?.text;
        if (!text) {
            return false;
        }
        return text.startsWith("0x") && text.length === 132;
    },
    handler: async (_runtime: IAgentRuntime, message: Memory, _state?: State, _options?: any, callback?: HandlerCallback) => {
        if (!callback) {
            return;
        }

        const signature = message.content?.text;
        if (!signature) {
            callback({ text: "⚠️ 메시지 내용이 없어 서명을 처리할 수 없습니다." });
            return;
        }
        
        // 임시로 서명 확인 기능을 비활성화하고 안내 메시지만 표시
        callback({ 
            text: "🔐 **서명을 받았습니다!**\n\n" +
                  "현재 서명 검증 및 트랜잭션 실행 기능을 업데이트 중입니다.\n" +
                  "곧 완전한 대출 서비스를 제공할 예정입니다.\n\n" +
                  `📝 **받은 서명**: ${signature.substring(0, 20)}...`
        });
        return;
    },
}; 