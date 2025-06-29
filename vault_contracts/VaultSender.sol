// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

interface IVault {
    function getCollateral(address user) external view returns (uint256);
    function getDebt(address user) external view returns (uint256);
}

contract VaultSender is OwnerIsCreator {
    // Custom errors to provide more descriptive revert messages.
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    error DestinationChainNotAllowlisted(uint64 destinationChainSelector);

    // Event emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        ActionType action,
        address user,
        uint256 amount,
        uint256 userCollateral,
        address feeToken,
        uint256 fees
    );

    event AllowlistedDestinationChainChanged(uint64 indexed chainSelector, bool allowed);

    IRouterClient private s_router;
    LinkTokenInterface private s_linkToken;
    IVault private s_vault;

    // Mapping to keep track of allowlisted destination chains.
    mapping(uint64 => bool) public allowlistedDestinationChains;

    modifier onlyAllowlistedDestinationChain(uint64 _destinationChainSelector) {
        if (!allowlistedDestinationChains[_destinationChainSelector])
            revert DestinationChainNotAllowlisted(_destinationChainSelector);
        _;
    }

    constructor(address _router, address _link, address _vault) {
        s_router = IRouterClient(_router);
        s_linkToken = LinkTokenInterface(_link);
        s_vault = IVault(_vault);
    }

    enum ActionType {
        LEND,
        REPAY
    }

    struct MessageData {
        ActionType action;
        address user;
        uint256 amount;
        uint256 userCollateral;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    function sendLendRequest(
        uint64 destinationChainSelector,
        address receiver,
        address user,
        uint256 amount
    ) external onlyOwner returns (bytes32 messageId) {
        // 기존 함수는 더 이상 사용하지 않음 - 보안상 서명 필수
        revert("Use sendLendRequestWithSignature for secure lending");
    }

    function sendRepayRequest(
        uint64 destinationChainSelector,
        address receiver,
        address user,
        uint256 amount
    ) external payable onlyOwner onlyAllowlistedDestinationChain(destinationChainSelector) returns (bytes32 messageId) {
        uint256 userCollateral = s_vault.getCollateral(user);
        
        MessageData memory data = MessageData(
            ActionType.REPAY, 
            user, 
            amount,
            userCollateral,
            0,
            0,
            bytes("")
        );
        bytes memory encodedData = abi.encode(data);

        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: encodedData,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: 200_000,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(s_linkToken)
        });

        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);

        if (fees > s_linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(s_linkToken.balanceOf(address(this)), fees);

        s_linkToken.approve(address(s_router), fees);

        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);

        emit MessageSent(
            messageId,
            destinationChainSelector,
            receiver,
            ActionType.REPAY,
            user,
            amount,
            userCollateral,
            address(s_linkToken),
            fees
        );

        return messageId;
    }

    function sendLendRequestWithSignature(
        uint64 destinationChainSelector,
        address receiver,
        address user,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) external onlyOwner onlyAllowlistedDestinationChain(destinationChainSelector) returns (bytes32 messageId) {
        uint256 userCollateral = s_vault.getCollateral(user);
        
        MessageData memory data = MessageData(
            ActionType.LEND, 
            user, 
            amount,
            userCollateral,
            nonce,
            deadline,
            signature
        );
        bytes memory encodedData = abi.encode(data);

        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: encodedData,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: 500_000,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(s_linkToken)
        });

        uint256 fees = s_router.getFee(destinationChainSelector, evm2AnyMessage);

        if (fees > s_linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(s_linkToken.balanceOf(address(this)), fees);

        s_linkToken.approve(address(s_router), fees);
        messageId = s_router.ccipSend(destinationChainSelector, evm2AnyMessage);

        emit MessageSent(
            messageId,
            destinationChainSelector,
            receiver,
            ActionType.LEND,
            user,
            amount,
            userCollateral,
            address(s_linkToken),
            fees
        );

        return messageId;
    }

    /// @dev Updates the allowlist status of a destination chain for transactions.
    /// @notice This function can only be called by the owner.
    function allowlistDestinationChain(
        uint64 _destinationChainSelector,
        bool allowed
    ) external onlyOwner {
        allowlistedDestinationChains[_destinationChainSelector] = allowed;
        emit AllowlistedDestinationChainChanged(_destinationChainSelector, allowed);
    }

    // ETH를 받을 수 있도록 하는 함수 (명시적 호출)
    function fundContract() external payable {
        // 누구나 컨트랙트에 ETH를 전송할 수 있음
        require(msg.value > 0, "Send some ETH");
    }

    // ETH를 받을 수 있도록 하는 함수 (fallback)
    receive() external payable {
        // ETH 수신 허용
    }

    // Owner가 ETH를 출금할 수 있는 함수 (필요시)
    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        payable(owner()).transfer(amount);
    }

    // 컨트랙트의 ETH 잔액 확인 함수
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
