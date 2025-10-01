#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LoadTester } from './lib/load-tester';
import { LoadTestConfig, LoadTestOptions } from './types';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

// ข้อมูลเวอร์ชัน
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

program
  .name('ethereum-load-tester')
  .description('TypeScript tool for load testing Ethereum transactions to measure TPS')
  .version(packageJson.version);

program
  .command('test')
  .description('Run Ethereum transaction load test')
  .requiredOption('-r, --rpc <url>', 'Ethereum RPC URL')
  .requiredOption('-k, --private-key <key>', 'Private key for sending transactions')
  .requiredOption('-t, --target <address>', 'Target address to send transactions to')
  .option('-c, --count <number>', 'Number of transactions to send', '100')
  .option('--concurrency <number>', 'Number of concurrent transactions', '10')
  .option('-v, --value <amount>', 'Amount of ETH to send per transaction', '0')
  .option('-g, --gas-limit <limit>', 'Gas limit per transaction', '21000')
  .option('--gas-price <price>', 'Gas price in Gwei')
  .option('-d, --duration <seconds>', 'Maximum test duration in seconds', '300')
  .option('--verbose', 'Enable verbose logging')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .option('-o, --output <file>', 'Output results to JSON file')
  .option('--no-real-time', 'Disable real-time statistics')
  .action(async (options) => {
    try {
      await runLoadTest(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration and connection')
  .requiredOption('-r, --rpc <url>', 'Ethereum RPC URL')
  .requiredOption('-k, --private-key <key>', 'Private key for validation')
  .action(async (options) => {
    try {
      await validateConfig(options);
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * รัน Load Test
 */
async function runLoadTest(options: any): Promise<void> {
  const spinner = ora('Initializing load test...').start();

  try {
    // สร้าง configuration
    const config: LoadTestConfig = {
      rpcUrl: options.rpc,
      privateKey: options.privateKey,
      targetAddress: options.target,
      transactionCount: parseInt(options.count),
      concurrency: parseInt(options.concurrency),
      value: options.value,
      gasLimit: parseInt(options.gasLimit),
      gasPrice: options.gasPrice,
      duration: parseInt(options.duration)
    };

    const testOptions: LoadTestOptions = {
      verbose: options.verbose,
      logLevel: options.logLevel,
      outputFile: options.output,
      realTimeStats: options.realTime !== false
    };

    // สร้าง LoadTester instance
    const loadTester = new LoadTester(config, testOptions);

    // Event listeners สำหรับ real-time updates
    if (testOptions.realTimeStats) {
      loadTester.on('stats', (stats) => {
        spinner.text = `TPS: ${stats.averageTPS?.toFixed(2)} | Success: ${stats.successfulTransactions} | Failed: ${stats.failedTransactions} | Pending: ${stats.pendingTransactions}`;
      });
    }

    // เริ่มต้น LoadTester
    await loadTester.initialize();
    spinner.succeed('Load tester initialized');

    // แสดงข้อมูลการทดสอบ
    console.log(chalk.cyan('\n📊 Load Test Configuration:'));
    console.log(`  RPC URL: ${config.rpcUrl}`);
    console.log(`  Target Address: ${config.targetAddress}`);
    console.log(`  Transaction Count: ${config.transactionCount}`);
    console.log(`  Concurrency: ${config.concurrency}`);
    console.log(`  Value per TX: ${config.value || '0'} ETH`);
    console.log(`  Gas Limit: ${config.gasLimit}`);
    if (config.gasPrice) {
      console.log(`  Gas Price: ${config.gasPrice} Gwei`);
    }
    console.log(`  Max Duration: ${config.duration} seconds\n`);

    // เริ่มการทดสอบ
    spinner.start('Running load test...');
    
    const startTime = Date.now();
    const metrics = await loadTester.startLoadTest();
    const endTime = Date.now();

    spinner.succeed('Load test completed!');

    // แสดงผลลัพธ์
    displayResults(metrics, endTime - startTime);

    // บันทึกผลลัพธ์ลงไฟล์ถ้าระบุ
    if (options.output) {
      await saveResults(options.output, metrics, config);
      console.log(chalk.green(`\n💾 Results saved to: ${options.output}`));
    }

    // ปิดการเชื่อมต่อ
    loadTester.disconnect();

  } catch (error) {
    spinner.fail('Load test failed');
    throw error;
  }
}

/**
 * ตรวจสอบ configuration และการเชื่อมต่อ
 */
async function validateConfig(options: any): Promise<void> {
  const spinner = ora('Validating configuration...').start();

  try {
    const { TransactionSender } = await import('./lib/transaction-sender');
    const sender = new TransactionSender(options.rpc, options.privateKey);
    
    await sender.initialize();
    
    const walletInfo = await sender.getWalletInfo();
    const networkInfo = await sender.getNetworkInfo();
    
    sender.disconnect();
    
    spinner.succeed('Configuration validated successfully!');
    
    console.log(chalk.green('\n✅ Validation Results:'));
    console.log(`  Wallet Address: ${walletInfo.address}`);
    console.log(`  Balance: ${walletInfo.balance} ETH`);
    console.log(`  Current Nonce: ${walletInfo.nonce}`);
    console.log(`  Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`);
    console.log(`  Block Number: ${networkInfo.blockNumber}`);
    console.log(`  Gas Price: ${networkInfo.gasPrice} Gwei`);
    
    // ตรวจสอบ balance
    const balance = parseFloat(walletInfo.balance);
    if (balance < 0.01) {
      console.log(chalk.yellow('\n⚠️  Warning: Low balance detected. Make sure you have enough ETH for testing.'));
    }
    
  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}

/**
 * แสดงผลลัพธ์การทดสอบ
 */
function displayResults(metrics: any, duration: number): void {
  console.log(chalk.cyan('\n📈 Load Test Results:'));
  console.log(chalk.green('═'.repeat(50)));
  
  console.log(`  Total Transactions: ${metrics.totalTransactions}`);
  console.log(`  Successful: ${chalk.green(metrics.successfulTransactions)}`);
  console.log(`  Failed: ${chalk.red(metrics.failedTransactions)}`);
  console.log(`  Pending: ${chalk.yellow(metrics.pendingTransactions)}`);
  
  console.log(chalk.cyan('\n⚡ Performance Metrics:'));
  console.log(`  Average TPS: ${chalk.bold(metrics.averageTPS.toFixed(2))}`);
  console.log(`  Peak TPS: ${chalk.bold(metrics.peakTPS.toFixed(2))}`);
  console.log(`  Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
  
  if (metrics.averageConfirmationTime > 0) {
    console.log(`  Avg Confirmation Time: ${(metrics.averageConfirmationTime / 1000).toFixed(2)} seconds`);
  }
  
  console.log(chalk.cyan('\n💰 Cost Analysis:'));
  console.log(`  Total Gas Used: ${metrics.gasUsedTotal.toLocaleString()}`);
  console.log(`  Estimated Cost: ${metrics.totalCost} ETH`);
  
  // แสดงข้อมูล blocks
  if (metrics.blockNumbers && metrics.blockNumbers.length > 0) {
    console.log(chalk.cyan('\n🧱 Block Information:'));
    console.log(`  Total Blocks Used: ${metrics.uniqueBlocks}`);
    const uniqueBlocks = [...new Set(metrics.blockNumbers as number[])].sort((a, b) => a - b);
    console.log(`  Block Numbers: ${uniqueBlocks.join(', ')}`);
    
    // แสดง block range ถ้ามีหลาย blocks
    if (metrics.uniqueBlocks > 1) {
      console.log(`  Block Range: ${uniqueBlocks[0]} - ${uniqueBlocks[uniqueBlocks.length - 1]}`);
    }
  }
  
  // คำนวณ success rate
  const successRate = metrics.totalTransactions > 0 
    ? (metrics.successfulTransactions / metrics.totalTransactions * 100).toFixed(2)
    : '0';
  
  console.log(chalk.cyan('\n📊 Success Rate:'));
  console.log(`  ${successRate}% (${metrics.successfulTransactions}/${metrics.totalTransactions})`);
  
  console.log(chalk.green('═'.repeat(50)));
}

/**
 * บันทึกผลลัพธ์ลงไฟล์
 */
async function saveResults(filename: string, metrics: any, config: LoadTestConfig): Promise<void> {
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      privateKey: '[REDACTED]' // ไม่บันทึก private key
    },
    metrics,
    summary: {
      successRate: metrics.totalTransactions > 0 
        ? (metrics.successfulTransactions / metrics.totalTransactions * 100).toFixed(2) + '%'
        : '0%',
      avgTPS: metrics.averageTPS.toFixed(2),
      peakTPS: metrics.peakTPS.toFixed(2)
    }
  };
  
  await fs.promises.writeFile(filename, JSON.stringify(results, null, 2));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Received SIGINT. Shutting down gracefully...'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n⚠️  Received SIGTERM. Shutting down gracefully...'));
  process.exit(0);
});

// Parse command line arguments
program.parse();