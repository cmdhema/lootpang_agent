import { Plugin } from "@elizaos/core";
import { depositCollateralAction } from './actions/depositCollateralAction.ts';
import { requestLoanAction } from './actions/requestLoanAction.ts';
import { checkStatusAction } from './actions/checkStatusAction.ts';
import { confirmSignatureAction } from './actions/confirmSignatureAction.ts';
import { repayLoanAction } from './actions/repayLoanAction.ts';
import { withdrawCollateralAction } from './actions/withdrawCollateralAction.ts';

export const lendingPlugin: Plugin = {
    name: "lending-ccip",
    description: "A plugin for handling cross-chain lending via Chainlink CCIP.",
    actions: [
        requestLoanAction,
        confirmSignatureAction,
        checkStatusAction,
        depositCollateralAction,
        repayLoanAction,
        withdrawCollateralAction
    ],
    routes: [],
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