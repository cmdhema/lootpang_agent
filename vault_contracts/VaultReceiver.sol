// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";

interface IVault {
    function lendKKCWithSignature(address to, uint256 amount, uint256 userCollateral, uint256 nonce, uint256 deadline, bytes memory signature) external;
    function repayFromRemote(address user, uint256 amount) external;
}

interface IKkcToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract VaultReceiver is CCIPReceiver, OwnerIsCreator {
    IVault public vault;
    IKkcToken public kkcToken;

    // Custom errors
    error SourceChainNotAllowed(uint64 sourceChainSelector);
    error SenderNotAllowed(address sender);

    // Mappings to keep track of allowlisted source chains and senders.
    mapping(uint64 => bool) public allowlistedSourceChains;
    mapping(address => bool) public allowlistedSenders;

    enum ActionType {
        LEND,
        REPAY
    }

    struct MessageData {
        ActionType action;
        address user;
        uint256 amount;
        uint256 userCollateral;  // 담보 정보
        uint256 nonce;           // 서명 nonce
        uint256 deadline;        // 서명 만료 시간
        bytes signature;         // 사용자 서명
    }

    event LoanExecutedWithSignature(address indexed user, uint256 kkcAmount, uint256 userCollateral, uint256 nonce);
    event RepaymentExecuted(address indexed user, uint256 amount);
    event AllowlistedSourceChainChanged(uint64 indexed chainSelector, bool allowed);
    event AllowlistedSenderChanged(address indexed sender, bool allowed);

    constructor(address _router, address _vault, address _kkcToken) CCIPReceiver(_router) {
        vault = IVault(_vault);
        kkcToken = IKkcToken(_kkcToken);
    }

    function _ccipReceive(
        Client.Any2EVMMessage memory message
    ) internal override {
        address sourceSender = abi.decode(message.sender, (address));
        require(allowlistedSourceChains[message.sourceChainSelector], "Source chain not allowed");
        require(allowlistedSenders[sourceSender], "Sender not allowed");

        MessageData memory data = abi.decode(message.data, (MessageData));

        if (data.action == ActionType.LEND) {
            // 서명이 있는지 확인
            require(data.signature.length > 0, "Signature required for loan");
            
            // 서명 검증과 함께 대출 실행 (담보 정보 포함)
            vault.lendKKCWithSignature(
                data.user, 
                data.amount, 
                data.userCollateral,
                data.nonce,
                data.deadline,
                data.signature
            );
            emit LoanExecutedWithSignature(data.user, data.amount, data.userCollateral, data.nonce);
            
        } else if (data.action == ActionType.REPAY) {
            // 실제 KKCoin 전송
            require(kkcToken.transferFrom(data.user, address(vault), data.amount), "KKC transfer failed");
            vault.repayFromRemote(data.user, data.amount);
            emit RepaymentExecuted(data.user, data.amount);
        }
    }

    /// @dev Updates the allowlist status of a source chain
    function allowlistSourceChain(
        uint64 _sourceChainSelector,
        bool allowed
    ) external onlyOwner {
        allowlistedSourceChains[_sourceChainSelector] = allowed;
        emit AllowlistedSourceChainChanged(_sourceChainSelector, allowed);
    }

    /// @dev Updates the allowlist status of a sender.
    function allowlistSender(address _sender, bool allowed) external onlyOwner {
        allowlistedSenders[_sender] = allowed;
        emit AllowlistedSenderChanged(_sender, allowed);
    }

    receive() external payable {}
}
