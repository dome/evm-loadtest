// Types สำหรับ Ethereum Load Testing Project

export interface LoadTestConfig {
  rpcUrl: string;
  privateKey: string;
  targetAddress: string;
  transactionCount: number;
  concurrency: number;
  gasPrice?: string;
  gasLimit?: number;
  value?: string;
  duration?: number; // ระยะเวลาในการทดสอบ (วินาที)
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  gasUsed?: number;
  gasPrice?: string;
  error?: string;
  confirmationTime?: number; // เวลาที่ใช้ในการ confirm (ms)
  blockNumber?: number; // Block number ที่ transaction ถูก mine
  blockHash?: string; // Block hash ที่ transaction ถูก mine
}

export interface LoadTestMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  averageTPS: number;
  peakTPS: number;
  averageConfirmationTime: number;
  totalDuration: number;
  startTime: number;
  endTime: number;
  gasUsedTotal: number;
  totalCost: string; // ใน ETH
  blockNumbers: number[]; // รายการ block numbers ที่ transactions ถูก mine
  uniqueBlocks: number; // จำนวน unique blocks ที่ใช้
}

export interface TPSSnapshot {
  timestamp: number;
  tps: number;
  successCount: number;
  failureCount: number;
}

export interface WalletInfo {
  address: string;
  balance: string;
  nonce: number;
}

export interface NetworkInfo {
  chainId: number;
  blockNumber: number;
  gasPrice: string;
  networkName: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoadTestOptions {
  verbose?: boolean;
  logLevel?: LogLevel;
  outputFile?: string;
  realTimeStats?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}