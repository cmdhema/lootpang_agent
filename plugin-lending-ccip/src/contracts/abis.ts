export const VAULT_ABI = [
    "function depositCollateral() external payable",
    "function lendKKC(address to, uint256 amount) external",
    "function lendKKCWithSignature(address to, uint256 amount, uint256 userCollateral, uint256 nonce, uint256 deadline, bytes memory signature) external",
    "function repay(uint256 amount) external",
    "function repayFromRemote(address user, uint256 amount) external",
    "function withdrawCollateral(uint256 amount) external",
    "function getCollateral(address user) external view returns (uint256)",
    "function getDebt(address user) external view returns (uint256)",
    "function getMaxLoanAmount(address user) external view returns (uint256)",
    "function getRequiredCollateral(uint256 kkcAmount) external pure returns (uint256)",
    "function getCollateralRatio(address user) external view returns (uint256)",
    "function getEthToKkcRate() external pure returns (uint256)",
    "function nonces(address user) external view returns (uint256)",
    "function setAuthorizedCaller(address caller, bool authorized) external",
    "event CollateralDeposited(address indexed user, uint256 amount)",
    "event LoanIssued(address indexed user, uint256 kkcAmount, uint256 collateralUsed)",
    "event LoanRepaid(address indexed user, uint256 amount)"
];

export const VAULT_SENDER_ABI = [
    "function sendLendRequestWithSignature(uint64 destinationChainSelector, address receiver, address user, uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external returns (bytes32)",
    "function sendRepayRequest(uint64 destinationChainSelector, address receiver, address user, uint256 amount) external payable returns (bytes32)",
    "function allowlistDestinationChain(uint64 _destinationChainSelector, bool allowed) external",
    "function fundContract() external payable",
    "function withdrawETH(uint256 amount) external",
    "function getETHBalance() external view returns (uint256)",
    "event MessageSent(bytes32 indexed messageId, uint64 indexed destinationChainSelector, address receiver, uint8 action, address user, uint256 amount, uint256 userCollateral, address feeToken, uint256 fees)",
    "event AllowlistedDestinationChainChanged(uint64 indexed chainSelector, bool allowed)"
];

export const VAULT_RECEIVER_ABI = [
    "event LoanExecutedWithSignature(address indexed user, uint256 kkcAmount, uint256 userCollateral, uint256 nonce)",
    "event RepaymentExecuted(address indexed user, uint256 amount)",
    "function allowlistSourceChain(uint64 _sourceChainSelector, bool allowed) external",
    "function allowlistSender(address _sender, bool allowed) external",
    "event AllowlistedSourceChainChanged(uint64 indexed chainSelector, bool allowed)",
    "event AllowlistedSenderChanged(address indexed sender, bool allowed)"
];

export const KKCOIN_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
]; 