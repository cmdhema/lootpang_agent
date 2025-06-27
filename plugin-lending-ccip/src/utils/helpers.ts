import { ethers } from 'ethers';
import { CONFIG } from '../config/constants.ts';

/**
 * 텍스트에서 ETH 금액 추출
 */
export function extractEthAmount(text: string): number {
    const patterns = [
        /(\d+\.?\d*)\s*ETH/i,
        /(\d+\.?\d*)\s*이더/i,
        /(\d+\.?\d*)\s*eth/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseFloat(match[1]);
        }
    }
    return 0;
}

/**
 * 텍스트에서 KKCoin 금액 추출
 */
export function extractKKCAmount(text: string): number {
    const patterns = [
        /(\d+)\s*KKCoin/i,
        /(\d+)\s*KKC/i,
        /(\d+)\s*케이케이코인/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseInt(match[1]);
        }
    }
    return 0;
}

/**
 * 담보 비율을 백분율로 변환
 */
export function formatCollateralRatio(ratio: bigint): string {
    const percentage = Number(ratio) / 100;
    return `${percentage.toFixed(1)}%`;
}

/**
 * 담보 비율에 따른 상태 아이콘
 */
export function getCollateralStatusIcon(ratio: bigint): string {
    const percentage = Number(ratio);
    if (percentage >= 2000) return "🟢"; // 200% 이상 - 안전
    if (percentage >= 1500) return "🟡"; // 150% 이상 - 주의
    return "🔴"; // 150% 미만 - 위험
}

/**
 * 담보 비율에 따른 상태 텍스트
 */
export function getCollateralStatusText(ratio: bigint): string {
    const percentage = Number(ratio);
    if (percentage >= 2000) return "안전";
    if (percentage >= 1500) return "주의";
    return "위험";
}

/**
 * Wei를 ETH로 포맷팅
 */
export function formatEther(wei: bigint): string {
    return ethers.formatEther(wei);
}

/**
 * ETH를 Wei로 변환
 */
export function parseEther(eth: string): bigint {
    return ethers.parseEther(eth);
}

/**
 * 트랜잭션 해시를 짧게 표시
 */
export function shortenTxHash(hash: string): string {
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * 주소를 짧게 표시
 */
export function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * KKCoin 수량에 필요한 ETH 담보 계산
 */
export function calculateRequiredCollateral(kkcAmount: number): string {
    const BASIS_POINTS = 10000; // 100% = 10000 basis points
    const requiredInWei = (BigInt(kkcAmount) * BigInt(CONFIG.COLLATERAL_RATIO) * BigInt(10 ** 18)) /
        (BigInt(BASIS_POINTS) * BigInt(CONFIG.ETH_TO_KKC_RATE));
    return ethers.formatEther(requiredInWei);
}

/**
 * 에러 메시지 파싱
 */
export function parseErrorMessage(error: any): string {
    if (error.reason) return error.reason;
    if (error.message) {
        // 일반적인 에러 패턴들
        if (error.message.includes('insufficient funds')) {
            return '잔액이 부족합니다';
        }
        if (error.message.includes('user rejected')) {
            return '사용자가 트랜잭션을 취소했습니다';
        }
        if (error.message.includes('network')) {
            return '네트워크 연결에 문제가 있습니다';
        }
        return error.message;
    }
    return '알 수 없는 오류가 발생했습니다';
} 