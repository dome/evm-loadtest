import { TransactionSender } from './transaction-sender';
import { 
  LoadTestConfig, 
  LoadTestMetrics, 
  TransactionResult, 
  TPSSnapshot,
  LoadTestOptions 
} from '../types';
import { EventEmitter } from 'events';

/**
 * Class สำหรับจัดการ Load Testing และวัด TPS
 */
export class LoadTester extends EventEmitter {
  private transactionSender: TransactionSender;
  private config: LoadTestConfig;
  private options: LoadTestOptions;
  private metrics: LoadTestMetrics;
  private tpsSnapshots: TPSSnapshot[] = [];
  private isRunning: boolean = false;
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(config: LoadTestConfig, options: LoadTestOptions = {}) {
    super();
    this.config = config;
    this.options = {
      verbose: false,
      logLevel: 'info',
      realTimeStats: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.transactionSender = new TransactionSender(config.rpcUrl, config.privateKey);
    this.metrics = this.createInitialMetrics();
  }

  /**
   * เริ่มต้น metrics
   */
  private createInitialMetrics(): LoadTestMetrics {
    return {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      pendingTransactions: 0,
      averageTPS: 0,
      peakTPS: 0,
      averageConfirmationTime: 0,
      totalDuration: 0,
      startTime: 0,
      endTime: 0,
      gasUsedTotal: 0,
      totalCost: '0',
      blockNumbers: [],
      uniqueBlocks: 0
    };
  }

  /**
   * เริ่มต้น Load Test
   */
  async initialize(): Promise<void> {
    try {
      await this.transactionSender.initialize();
      this.log('info', 'Load tester initialized successfully');
      
      // แสดงข้อมูล wallet และ network
      const walletInfo = await this.transactionSender.getWalletInfo();
      const networkInfo = await this.transactionSender.getNetworkInfo();
      
      this.log('info', `Wallet: ${walletInfo.address}`);
      this.log('info', `Balance: ${walletInfo.balance} ETH`);
      this.log('info', `Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`);
      this.log('info', `Current Gas Price: ${networkInfo.gasPrice} Gwei`);
      
    } catch (error) {
      throw new Error(`Failed to initialize load tester: ${error}`);
    }
  }

  /**
   * เริ่มการทดสอบ Load Test
   */
  async startLoadTest(): Promise<LoadTestMetrics> {
    if (this.isRunning) {
      throw new Error('Load test is already running');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.metrics.startTime = this.startTime;
    
    this.log('info', `Starting load test with ${this.config.transactionCount} transactions`);
    this.log('info', `Concurrency: ${this.config.concurrency}`);
    this.log('info', `Target address: ${this.config.targetAddress}`);

    try {
      // เริ่ม real-time monitoring ถ้าเปิดใช้งาน
      let monitoringInterval: NodeJS.Timeout | null = null;
      if (this.options.realTimeStats) {
        monitoringInterval = setInterval(() => {
          this.updateTpsSnapshot();
          this.emit('stats', this.getCurrentStats());
        }, 1000);
      }

      // ส่ง transactions ตาม concurrency ที่กำหนด
      const results = await this.executeConcurrentTransactions();
      
      // หยุด monitoring
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }

      // รอการ confirm ของ transactions ทั้งหมด
      await this.waitForAllConfirmations(results);

      this.endTime = Date.now();
      this.metrics.endTime = this.endTime;
      this.isRunning = false;

      // คำนวณ metrics สุดท้าย
      this.calculateFinalMetrics();
      
      this.log('info', 'Load test completed');
      this.emit('completed', this.metrics);
      
      return this.metrics;

    } catch (error) {
      this.isRunning = false;
      this.log('error', `Load test failed: ${error}`);
      throw error;
    }
  }

  /**
   * ส่ง transactions แบบ concurrent
   */
  private async executeConcurrentTransactions(): Promise<TransactionResult[]> {
    const results: TransactionResult[] = [];
    const batchSize = this.config.concurrency;
    const totalTransactions = this.config.transactionCount;
    
    for (let i = 0; i < totalTransactions; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalTransactions - i);
      
      this.log('debug', `Sending batch ${Math.floor(i / batchSize) + 1}, transactions: ${currentBatchSize}`);
      
      const batchResults = await this.transactionSender.sendBatchTransactions(
        this.config.targetAddress,
        currentBatchSize,
        this.config.value || '0',
        this.config.gasLimit || 21000,
        this.config.gasPrice
      );
      
      results.push(...batchResults);
      this.metrics.totalTransactions += currentBatchSize;
      
      // อัพเดท pending transactions
      this.metrics.pendingTransactions += batchResults.filter(r => r.status === 'pending').length;
      this.metrics.failedTransactions += batchResults.filter(r => r.status === 'failed').length;
      
      // หน่วงเวลาเล็กน้อยระหว่าง batch เพื่อไม่ให้ overwhelm network
      if (i + batchSize < totalTransactions) {
        await this.sleep(100);
      }
    }
    
    return results;
  }

  /**
   * รอการ confirm ของ transactions ทั้งหมด
   */
  private async waitForAllConfirmations(results: TransactionResult[]): Promise<void> {
    const pendingTxs = results.filter(r => r.status === 'pending');
    
    if (pendingTxs.length === 0) {
      return;
    }

    this.log('info', `Waiting for ${pendingTxs.length} transactions to be confirmed...`);
    
    const confirmationResults = await this.transactionSender.waitForBatchConfirmations(
      pendingTxs.map(tx => tx.hash),
      1,
      this.config.duration ? this.config.duration * 1000 : 300000
    );

    // อัพเดท metrics
    for (const result of confirmationResults) {
      if (result.status === 'success') {
        this.metrics.successfulTransactions++;
        this.metrics.pendingTransactions--;
        if (result.gasUsed) {
          this.metrics.gasUsedTotal += result.gasUsed;
        }
        // เก็บข้อมูล block number
        if (result.blockNumber) {
          this.metrics.blockNumbers.push(result.blockNumber);
        }
      } else if (result.status === 'failed') {
        this.metrics.failedTransactions++;
        this.metrics.pendingTransactions--;
      }
    }
  }

  /**
   * อัพเดท TPS snapshot
   */
  private updateTpsSnapshot(): void {
    const now = Date.now();
    const timeElapsed = (now - this.startTime) / 1000;
    const currentTPS = timeElapsed > 0 ? this.metrics.successfulTransactions / timeElapsed : 0;
    
    const snapshot: TPSSnapshot = {
      timestamp: now,
      tps: currentTPS,
      successCount: this.metrics.successfulTransactions,
      failureCount: this.metrics.failedTransactions
    };
    
    this.tpsSnapshots.push(snapshot);
    
    // เก็บเฉพาะ snapshot ล่าสุด 100 รายการ
    if (this.tpsSnapshots.length > 100) {
      this.tpsSnapshots.shift();
    }
  }

  /**
   * คำนวณ metrics สุดท้าย
   */
  private calculateFinalMetrics(): void {
    this.metrics.totalDuration = this.endTime - this.startTime;
    
    // คำนวณ average TPS
    if (this.metrics.totalDuration > 0) {
      this.metrics.averageTPS = (this.metrics.successfulTransactions * 1000) / this.metrics.totalDuration;
    }
    
    // หา peak TPS
    this.metrics.peakTPS = Math.max(...this.tpsSnapshots.map(s => s.tps), 0);
    
    // คำนวณ average confirmation time (ถ้ามีข้อมูล)
    const confirmationTimes = this.tpsSnapshots
      .map(s => s.timestamp - this.startTime)
      .filter(time => time > 0);
    
    if (confirmationTimes.length > 0) {
      this.metrics.averageConfirmationTime = 
        confirmationTimes.reduce((sum, time) => sum + time, 0) / confirmationTimes.length;
    }
    
    // คำนวณ total cost (ประมาณการ)
    if (this.metrics.gasUsedTotal > 0 && this.config.gasPrice) {
      const gasPriceWei = parseFloat(this.config.gasPrice) * 1e9; // Convert Gwei to Wei
      const totalCostWei = this.metrics.gasUsedTotal * gasPriceWei;
      this.metrics.totalCost = (totalCostWei / 1e18).toFixed(6); // Convert to ETH
    }
    
    // คำนวณ unique blocks
    const uniqueBlockNumbers = [...new Set(this.metrics.blockNumbers)];
    this.metrics.uniqueBlocks = uniqueBlockNumbers.length;
  }

  /**
   * ดึงสถิติปัจจุบัน
   */
  getCurrentStats(): Partial<LoadTestMetrics> {
    const now = Date.now();
    const timeElapsed = this.startTime > 0 ? now - this.startTime : 0;
    const currentTPS = timeElapsed > 0 ? (this.metrics.successfulTransactions * 1000) / timeElapsed : 0;
    
    return {
      totalTransactions: this.metrics.totalTransactions,
      successfulTransactions: this.metrics.successfulTransactions,
      failedTransactions: this.metrics.failedTransactions,
      pendingTransactions: this.metrics.pendingTransactions,
      averageTPS: currentTPS,
      totalDuration: timeElapsed
    };
  }

  /**
   * หยุดการทดสอบ
   */
  async stopLoadTest(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    this.endTime = Date.now();
    this.metrics.endTime = this.endTime;
    
    this.log('info', 'Load test stopped');
    this.emit('stopped', this.metrics);
  }

  /**
   * ดึง metrics ปัจจุบัน
   */
  getMetrics(): LoadTestMetrics {
    return { ...this.metrics };
  }

  /**
   * ดึง TPS snapshots
   */
  getTpsSnapshots(): TPSSnapshot[] {
    return [...this.tpsSnapshots];
  }

  /**
   * ปิดการเชื่อมต่อ
   */
  disconnect(): void {
    this.transactionSender.disconnect();
  }

  /**
   * Log message ตาม level ที่กำหนด
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel || 'info'];
    
    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}