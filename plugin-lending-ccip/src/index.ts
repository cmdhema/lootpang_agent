import { Plugin } from "@elizaos/core";
import { depositCollateralAction } from './actions/depositCollateralAction.ts';
import { requestLoanAction } from './actions/requestLoanAction.ts';
import { confirmSignatureAction } from './actions/confirmSignatureAction.ts';
import { checkStatusAction } from './actions/checkStatusAction.ts';
import { repayLoanAction } from './actions/repayLoanAction.ts';
import { withdrawCollateralAction } from './actions/withdrawCollateralAction.ts';

export const lendingPlugin: Plugin = {
    name: "lending-ccip",
    description: "크로스체인 담보 대출 시스템 - ETH 담보로 KKCoin 대출",
    actions: [
        depositCollateralAction,
        requestLoanAction,
        confirmSignatureAction,
        checkStatusAction,
        repayLoanAction,
        withdrawCollateralAction
    ],
    evaluators: [],
    providers: []
};

// 개별 액션들도 export
export {
    depositCollateralAction,
    requestLoanAction,
    confirmSignatureAction,
    checkStatusAction,
    repayLoanAction,
    withdrawCollateralAction
};

// 유틸리티들도 export
export { blockchainService } from './utils/blockchain.ts';
export * from './utils/helpers.ts';
export { CONFIG, CHAIN_IDS } from './config/constants.ts';
export * from './contracts/abis.ts';

export default lendingPlugin; 