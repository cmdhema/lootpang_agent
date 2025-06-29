import { config } from 'dotenv';
config();

export const ETHEREUM_SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "";
export const BASE_SEPOLIA_RPC = process.env.BASESEPOLIA_RPC_URL || "";
export const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || process.env.TEST_USER_PRIVATE_KEY || "";

// Sepolia Network (Source)
export const VAULT_SENDER_ADDRESS = process.env.SEPOLIA_VAULT_SENDER_CONTRACT || "";
export const SEPOLIA_VAULT_ADDRESS = process.env.SEPOLIA_VAULT_CONTRACT || "";

// Base Sepolia Network (Destination)
export const BASE_VAULT_ADDRESS = process.env.BASESEPOLIA_VAULT_CONTRACT || "";
export const VAULT_RECEIVER_ADDRESS = process.env.BASESEPOLIA_VAULT_RECEIVER_CONTRACT || "";

// Chain Selectors for CCIP
export const BASE_SEPOLIA_CHAIN_SELECTOR = process.env.BASE_SEPOLIA_CHAIN_SELECTOR || "10344971235874465080";

// Legacy - for backward compatibility
export const VAULT_ADDRESS = VAULT_RECEIVER_ADDRESS;

export const CONFIG = {
    // RPC URLs
    ETHEREUM_SEPOLIA_RPC: ETHEREUM_SEPOLIA_RPC,
    BASE_SEPOLIA_RPC: BASE_SEPOLIA_RPC,
    
    // Private Key
    PRIVATE_KEY: PRIVATE_KEY,
    
    // Contract Addresses
    VAULT_ADDRESS: VAULT_ADDRESS,
    VAULT_SENDER_ADDRESS: VAULT_SENDER_ADDRESS,
    VAULT_RECEIVER_ADDRESS: VAULT_RECEIVER_ADDRESS,
    SEPOLIA_VAULT_ADDRESS: SEPOLIA_VAULT_ADDRESS,
    BASE_VAULT_ADDRESS: BASE_VAULT_ADDRESS,
    KKCOIN_ADDRESS: process.env.KKCOIN_ADDRESS || '',
    
    // Chain Selectors
    BASE_SEPOLIA_CHAIN_SELECTOR: BASE_SEPOLIA_CHAIN_SELECTOR,
    
    // Constants
    COLLATERAL_RATIO: 150, // 150% 담보 비율
    LIQUIDATION_THRESHOLD: 120, // 120% 청산 임계점
    ETH_TO_KKC_RATE: 2000 // 1 ETH = 2000 KKC
};

export const CHAIN_IDS = {
    ETHEREUM_SEPOLIA: 11155111,
    BASE_SEPOLIA: 84532
} as const; 