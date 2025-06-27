import { ethers } from 'ethers';
import { VAULT_ABI, VAULT_SENDER_ABI } from '../contracts/abis.ts';
import { ETHEREUM_SEPOLIA_RPC, BASE_SEPOLIA_RPC, PRIVATE_KEY, VAULT_SENDER_ADDRESS } from '../config/constants';

export class BlockchainService {
    // Sepolia Network (Source)
    private sepoliaProvider: ethers.JsonRpcProvider;
    private sepoliaWallet: ethers.Wallet;
    
    // Base Sepolia Network (Destination)
    private baseSepoliaProvider: ethers.JsonRpcProvider;
    private baseSepoliaWallet: ethers.Wallet;

    constructor() {
        // Initialize Sepolia
        this.sepoliaProvider = new ethers.JsonRpcProvider(ETHEREUM_SEPOLIA_RPC);
        this.sepoliaWallet = new ethers.Wallet(PRIVATE_KEY, this.sepoliaProvider);
        
        // Initialize Base Sepolia
        this.baseSepoliaProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
        this.baseSepoliaWallet = new ethers.Wallet(PRIVATE_KEY, this.baseSepoliaProvider);
    }

    // Get Sepolia provider and wallet
    getSepoliaProvider() {
        return this.sepoliaProvider;
    }

    getSepoliaWallet() {
        return this.sepoliaWallet;
    }

    // Get Base Sepolia provider and wallet
    getBaseSepoliaProvider() {
        return this.baseSepoliaProvider;
    }

    getBaseSepoliaWallet() {
        return this.baseSepoliaWallet;
    }

    // Get wallet address from private key
    getWalletAddress(): string {
        return this.sepoliaWallet.address;
    }

    // Get Vault Sender contract (on Sepolia)
    getVaultSenderContract() {
        return new ethers.Contract(VAULT_SENDER_ADDRESS, VAULT_SENDER_ABI, this.sepoliaWallet);
    }

    // Ethereum Sepolia에서 Vault 컨트랙트 가져오기 (담보 관리용)
    getSepoliaVaultContract() {
        return new ethers.Contract(process.env.SEPOLIA_VAULT_ADDRESS || "", VAULT_ABI, this.sepoliaWallet);
    }

    // Base Sepolia에서 Vault 컨트랙트 가져오기 (대출 실행용)
    getBaseVaultContract() {
        return new ethers.Contract(process.env.BASE_VAULT_ADDRESS || "", VAULT_ABI, this.baseSepoliaWallet);
    }

    // 읽기 전용 Sepolia Vault 컨트랙트 (담보 관리용 - 가스비 없음)
    getSepoliaVaultContractReadOnly() {
        return new ethers.Contract(process.env.SEPOLIA_VAULT_ADDRESS || "", VAULT_ABI, this.sepoliaProvider);
    }

    // 읽기 전용 Base Vault 컨트랙트 (대출 실행용 - 가스비 없음)
    getBaseVaultContractReadOnly() {
        return new ethers.Contract(process.env.BASE_VAULT_ADDRESS || "", VAULT_ABI, this.baseSepoliaProvider);
    }

    // Get Vault Receiver contract (on Base Sepolia) - Legacy method
    getVaultReceiverContract() {
        return this.getBaseVaultContract();
    }

    // Legacy method for backward compatibility
    getVaultContract() {
        return this.getBaseVaultContract();
    }

    async getProvider() {
        return this.sepoliaProvider;
    }

    async getWallet() {
        return this.sepoliaWallet;
    }

    // Ethereum Sepolia에서 KKCoin 컨트랙트 가져오기
    getKKCoinContract() {
        const signer = this.sepoliaWallet.connect(this.sepoliaProvider);
        return new ethers.Contract(process.env.KKCOIN_ADDRESS || "", [], signer);
    }

    // 읽기 전용 Vault 컨트랙트 (가스비 없음) - Legacy
    getVaultContractReadOnly() {
        return this.getBaseVaultContractReadOnly();
    }

    // ETH 잔액 확인
    async getEthBalance(address: string): Promise<string> {
        const balance = await this.sepoliaProvider.getBalance(address);
        return ethers.formatEther(balance);
    }

    // KKCoin 잔액 확인
    async getKKCoinBalance(address: string): Promise<string> {
        const contract = this.getKKCoinContract();
        const balance = await contract.balanceOf(address);
        return balance.toString();
    }

    // 트랜잭션 수수료 추정
    async estimateGasPrice() {
        return await this.sepoliaProvider.getFeeData();
    }

    // 트랜잭션 대기
    async waitForTransaction(txHash: string, chainId: number = 11155111) {
        const provider = chainId === 84532 ? this.baseSepoliaProvider : this.sepoliaProvider;
        return await provider.waitForTransaction(txHash);
    }

    // 네트워크 정보 확인
    async getNetworkInfo() {
        const [sepoliaNetwork, baseSepoliaNetwork] = await Promise.all([
            this.sepoliaProvider.getNetwork(),
            this.baseSepoliaProvider.getNetwork()
        ]);
        
        return {
            sepolia: {
                name: sepoliaNetwork.name,
                chainId: Number(sepoliaNetwork.chainId)
            },
            baseSepolia: {
                name: baseSepoliaNetwork.name,
                chainId: Number(baseSepoliaNetwork.chainId)
            }
        };
    }
}

// 싱글톤 인스턴스
export const blockchainService = new BlockchainService(); 