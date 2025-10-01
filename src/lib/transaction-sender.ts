import { ethers } from 'ethers';
import { TransactionResult, WalletInfo, NetworkInfo } from '../types';

/**
 * Class สำหรับจัดการการส่ง transactions ไปยัง Ethereum network
 */
export class TransactionSender {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private nonce: number = 0;

  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * เริ่มต้น TransactionSender และดึงข้อมูล nonce ปัจจุบัน
   */
  async initialize(): Promise<void> {
    try {
      this.nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
    } catch (error) {
      throw new Error(`Failed to initialize TransactionSender: ${error}`);
    }
  }

  /**
   * ดึงข้อมูล wallet ปัจจุบัน
   */
  async getWalletInfo(): Promise<WalletInfo> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return {
      address: this.wallet.address,
      balance: ethers.formatEther(balance),
      nonce: this.nonce
    };
  }

  /**
   * ดึงข้อมูล network ปัจจุบัน
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    const feeData = await this.provider.getFeeData();
    
    return {
      chainId: Number(network.chainId),
      blockNumber,
      gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
      networkName: network.name
    };
  }

  /**
   * ส่ง transaction เดี่ยว
   */
  async sendTransaction(
    to: string,
    value: string = '0',
    gasLimit: number = 21000,
    gasPrice?: string
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      const txRequest: ethers.TransactionRequest = {
        to,
        value: ethers.parseEther(value),
        gasLimit,
        nonce: this.nonce++
      };

      // ใช้ gasPrice ที่กำหนด หรือดึงจาก network
      if (gasPrice) {
        txRequest.gasPrice = ethers.parseUnits(gasPrice, 'gwei');
      } else {
        const feeData = await this.provider.getFeeData();
        txRequest.gasPrice = feeData.gasPrice;
      }

      const tx = await this.wallet.sendTransaction(txRequest);
      
      return {
        hash: tx.hash,
        status: 'pending',
        timestamp: startTime,
        gasPrice: ethers.formatUnits(txRequest.gasPrice || 0, 'gwei')
      };
    } catch (error) {
      return {
        hash: '',
        status: 'failed',
        timestamp: startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ส่ง transactions หลายรายการพร้อมกัน
   */
  async sendBatchTransactions(
    to: string,
    count: number,
    value: string = '0',
    gasLimit: number = 21000,
    gasPrice?: string
  ): Promise<TransactionResult[]> {
    const promises: Promise<TransactionResult>[] = [];
    
    for (let i = 0; i < count; i++) {
      promises.push(this.sendTransaction(to, value, gasLimit, gasPrice));
    }

    return Promise.all(promises);
  }

  /**
   * รอการ confirm ของ transaction
   */
  async waitForConfirmation(
    txHash: string,
    confirmations: number = 1,
    timeout: number = 300000 // 5 นาที
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      const receipt = await this.provider.waitForTransaction(
        txHash,
        confirmations,
        timeout
      );

      if (!receipt) {
        return {
          hash: txHash,
          status: 'failed',
          timestamp: startTime,
          error: 'Transaction receipt not found'
        };
      }

      return {
        hash: txHash,
        status: receipt.status === 1 ? 'success' : 'failed',
        timestamp: startTime,
        gasUsed: Number(receipt.gasUsed),
        gasPrice: ethers.formatUnits(receipt.gasPrice || 0, 'gwei'),
        confirmationTime: Date.now() - startTime,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash
      };
    } catch (error) {
      return {
        hash: txHash,
        status: 'failed',
        timestamp: startTime,
        error: error instanceof Error ? error.message : 'Confirmation timeout',
        confirmationTime: Date.now() - startTime
      };
    }
  }

  /**
   * รอการ confirm ของ transactions หลายรายการ
   */
  async waitForBatchConfirmations(
    txHashes: string[],
    confirmations: number = 1,
    timeout: number = 300000
  ): Promise<TransactionResult[]> {
    const promises = txHashes.map(hash => 
      this.waitForConfirmation(hash, confirmations, timeout)
    );
    
    return Promise.all(promises);
  }

  /**
   * ตรวจสอบสถานะของ transaction
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return null;

      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          hash: txHash,
          status: 'pending',
          timestamp: Date.now(),
          gasPrice: ethers.formatUnits(tx.gasPrice || 0, 'gwei')
        };
      }

      return {
        hash: txHash,
        status: receipt.status === 1 ? 'success' : 'failed',
        timestamp: Date.now(),
        gasUsed: Number(receipt.gasUsed),
        gasPrice: ethers.formatUnits(receipt.gasPrice || 0, 'gwei'),
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash
      };
    } catch (error) {
      return {
        hash: txHash,
        status: 'failed',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * รีเซ็ต nonce (ใช้เมื่อต้องการเริ่มใหม่)
   */
  async resetNonce(): Promise<void> {
    this.nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
  }

  /**
   * ปิดการเชื่อมต่อ
   */
  disconnect(): void {
    this.provider.destroy();
  }
}