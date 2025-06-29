// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IKkcToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract Vault is Ownable, EIP712 {
    IERC20 public kkcToken;

    // 권한 위임을 위한 authorized caller 추가
    mapping(address => bool) public authorizedCallers;

    mapping(address => uint256) public debt;
    mapping(address => uint256) public collateral;

    // EIP-712 서명 검증을 위한 상수들
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant LOAN_REQUEST_TYPEHASH =
        keccak256(
            "LoanRequest(address user,uint256 amount,uint256 nonce,uint256 deadline)"
        );
    bytes32 public immutable DOMAIN_SEPARATOR;

    // 사용자별 nonce 관리
    mapping(address => uint256) public nonces;

    // 가격 상수 (1 ETH = 10,000 KKCoin)
    uint256 public constant ETH_TO_KKC_RATE = 10000;
    // 담보 비율 (150% = 1500 basis points)
    uint256 public constant COLLATERAL_RATIO = 15000; // 150%
    uint256 public constant BASIS_POINTS = 10000; // 100%

    event CollateralDeposited(address indexed user, uint256 amount);
    event LoanIssued(
        address indexed user,
        uint256 kkcAmount,
        uint256 collateralUsed
    );
    event LoanRepaid(address indexed user, uint256 amount);

    modifier onlyOwnerOrAuthorized() {
        require(
            msg.sender == owner() || authorizedCallers[msg.sender],
            "Only owner or authorized caller"
        );
        _;
    }

    constructor(
        address initialOwner,
        address _kkcTokenAddress
    ) EIP712("VaultLending", "1") {
        kkcToken = IERC20(_kkcTokenAddress);
        _transferOwnership(initialOwner);

        // EIP-712 도메인 분리자 계산
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("VaultLending")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev 가격 피드 함수 (하드코딩된 가격)
     * @return ETH 1개당 KKCoin 개수
     */
    function getEthToKkcRate() public pure returns (uint256) {
        return ETH_TO_KKC_RATE;
    }

    /**
     * @dev ETH 담보 예치
     */
    function depositCollateral() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        collateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /**
     * @dev KKCoin 대출 (담보 비율 검증 포함)
     * @param to 대출받을 주소
     * @param amount 대출할 KKCoin 수량
     */
    function lendKKC(address to, uint256 amount) external {
        require(msg.sender == owner(), "Only owner can lend");
        require(amount > 0, "Amount must be greater than 0");

        // 필요한 담보 계산 (150% 담보 비율)
        uint256 requiredCollateralInKkc = (amount * COLLATERAL_RATIO) /
            BASIS_POINTS;
        uint256 requiredCollateralInEth = (requiredCollateralInKkc * 1 ether) /
            ETH_TO_KKC_RATE;

        // 현재 담보에서 기존 부채에 대한 담보를 제외한 사용 가능한 담보 계산
        uint256 currentDebtInKkc = debt[to];
        uint256 collateralForCurrentDebt = 0;
        if (currentDebtInKkc > 0) {
            collateralForCurrentDebt =
                (currentDebtInKkc * COLLATERAL_RATIO * 1 ether) /
                (BASIS_POINTS * ETH_TO_KKC_RATE);
        }

        uint256 availableCollateral = collateral[to] > collateralForCurrentDebt
            ? collateral[to] - collateralForCurrentDebt
            : 0;

        require(
            availableCollateral >= requiredCollateralInEth,
            "Insufficient collateral for loan"
        );

        // KKCoin 전송 및 부채 기록
        require(kkcToken.transfer(to, amount), "KKC transfer failed");
        debt[to] += amount;

        emit LoanIssued(to, amount, requiredCollateralInEth);
    }

    /**
     * @notice EIP-712 서명을 기반으로 사용자에게 KKC를 대출합니다.
     * @dev 이 함수는 VaultReceiver 컨트랙트에 의해 호출되는 것을 가정합니다.
     * @param to 대출을 받을 사용자의 주소
     * @param amount 대출할 KKC의 양 (18자리 소수점)
     * @param userCollateral 사용자의 총 담보량 (ETH, wei 단위)
     * @param nonce 서명에 사용된 nonce
     * @param deadline 서명의 유효기간 (Unix timestamp)
     * @param signature 사용자가 생성한 EIP-712 서명
     */
    function lendKKCWithSignature(
        address to,
        uint256 amount,
        uint256 userCollateral,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) external {
        // VaultReceiver 또는 오너만 호출 가능
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "Only authorized callers or owner can call"
        );

        // EIP-712 서명 검증
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LOAN_REQUEST_TYPEHASH,
                    to,
                    amount,
                    nonce,
                    deadline
                )
            )
        );
        address signer = ECDSA.recover(digest, signature);
        require(signer == to, "Invalid signature");
        
        // 기타 검증
        require(block.timestamp <= deadline, "Loan request has expired");
        require(nonces[to] == nonce, "Invalid nonce");

        // nonce 증가
        nonces[to]++;

        // 담보 검증을 KKC 단위로 통일하여 계산
        // 사용자의 총 담보(ETH)를 KKC 가치로 변환합니다.
        // userCollateral은 Sepolia 체인에서 가져온 사용자의 ETH 담보량(wei)입니다.
        uint256 userCollateralInKkcValue = userCollateral * ETH_TO_KKC_RATE;

        // 총 부채 (기존 부채 + 신규 대출)
        uint256 totalDebt = debt[to] + amount;

        // 총 부채에 대해 필요한 총 담보 가치를 KKC 단위로 계산합니다. (담보 비율 적용)
        uint256 totalRequiredCollateralInKkcValue = (totalDebt * COLLATERAL_RATIO) / BASIS_POINTS;
        
        require(
            userCollateralInKkcValue >= totalRequiredCollateralInKkcValue,
            "Insufficient available collateral"
        );

        // KKCoin 전송 및 부채 기록
        require(kkcToken.transfer(to, amount), "KKC transfer failed");
        debt[to] = totalDebt;

        // 이벤트에 사용될 requiredCollateralInEth 값을 다시 계산합니다.
        // 이 값은 이번 대출 'amount'에 대해서만 필요한 담보량을 나타냅니다.
        uint256 requiredCollateralForThisLoanInKkc = (amount * COLLATERAL_RATIO) / BASIS_POINTS;
        uint256 requiredCollateralInEth = requiredCollateralForThisLoanInKkc / ETH_TO_KKC_RATE;
        
        emit LoanIssued(to, amount, requiredCollateralInEth);
    }

    /**
     * @dev ECDSA 서명에서 서명자 복구
     */
    function recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature recovery id");

        return ecrecover(hash, v, r, s);
    }

    /**
     * @dev 대출 상환
     * @param amount 상환할 KKCoin 수량
     */
    function repay(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(debt[msg.sender] >= amount, "Repaying more than owed");

        require(
            kkcToken.transferFrom(msg.sender, address(this), amount),
            "KKC repayment transfer failed"
        );
        debt[msg.sender] -= amount;

        emit LoanRepaid(msg.sender, amount);
    }

    /**
     * @dev 원격에서 대출 상환 (CCIP용)
     * @param user 상환할 사용자 주소
     * @param amount 상환할 KKCoin 수량
     */
    function repayFromRemote(address user, uint256 amount) external {
        require(
            msg.sender == owner() || authorizedCallers[msg.sender],
            "Only owner or authorized caller can repay from remote"
        );
        require(amount > 0, "Amount must be greater than 0");
        require(debt[user] >= amount, "Repaying more than owed");

        debt[user] -= amount;

        emit LoanRepaid(user, amount);
    }

    /**
     * @dev 담보 인출 (부채가 없을 때만)
     * @param amount 인출할 ETH 수량
     */
    function withdrawCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(collateral[msg.sender] >= amount, "Insufficient collateral");

        // 부채가 있는 경우 담보 비율 확인
        if (debt[msg.sender] > 0) {
            uint256 remainingCollateral = collateral[msg.sender] - amount;
            uint256 requiredCollateral = (debt[msg.sender] *
                COLLATERAL_RATIO *
                1 ether) / (BASIS_POINTS * ETH_TO_KKC_RATE);
            require(
                remainingCollateral >= requiredCollateral,
                "Would break collateral ratio"
            );
        }

        collateral[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    /**
     * @dev 사용자의 최대 대출 가능 금액 계산
     * @param user 사용자 주소
     * @return 최대 대출 가능한 KKCoin 수량
     */
    function getMaxLoanAmount(address user) external view returns (uint256) {
        uint256 userCollateral = collateral[user];
        uint256 userDebt = debt[user];

        // 담보로 대출 가능한 최대 KKCoin 수량
        uint256 maxLoanFromCollateral = (userCollateral *
            ETH_TO_KKC_RATE *
            BASIS_POINTS) / (1 ether * COLLATERAL_RATIO);

        // 현재 부채를 제외한 추가 대출 가능 금액
        if (maxLoanFromCollateral > userDebt) {
            return maxLoanFromCollateral - userDebt;
        } else {
            return 0;
        }
    }

    /**
     * @dev 특정 KKCoin 수량을 빌리기 위해 필요한 ETH 담보 계산
     * @param kkcAmount 빌리고자 하는 KKCoin 수량
     * @return 필요한 ETH 담보 수량 (wei 단위)
     */
    function getRequiredCollateral(
        uint256 kkcAmount
    ) external pure returns (uint256) {
        return
            (kkcAmount * COLLATERAL_RATIO * 1 ether) /
            (BASIS_POINTS * ETH_TO_KKC_RATE);
    }

    /**
     * @dev 사용자의 담보 비율 계산
     * @param user 사용자 주소
     * @return 담보 비율 (basis points, 15000 = 150%)
     */
    function getCollateralRatio(address user) external view returns (uint256) {
        uint256 userDebt = debt[user];
        if (userDebt == 0) return type(uint256).max; // 부채가 없으면 무한대 비율

        uint256 collateralValueInKkc = (collateral[user] * ETH_TO_KKC_RATE) /
            1 ether;
        return (collateralValueInKkc * BASIS_POINTS) / userDebt;
    }

    function getDebt(address user) external view returns (uint256) {
        return debt[user];
    }

    function getCollateral(address user) external view returns (uint256) {
        return collateral[user];
    }

    // Owner가 특정 주소에 권한 부여
    function setAuthorizedCaller(address caller, bool authorized) external {
        require(msg.sender == owner(), "Only owner can set authorized caller");
        authorizedCallers[caller] = authorized;
    }
}
