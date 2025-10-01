# Ethereum Load Tester

โปรเจกต์ TypeScript สำหรับทดสอบการส่ง transactions เข้าไปที่ Ethereum node เพื่อวัด TPS (Transactions Per Second) และ performance metrics อื่นๆ

## ✨ Features

- 🚀 **High Performance**: รองรับการส่ง transactions แบบ concurrent
- 📊 **Real-time Metrics**: แสดงสถิติ TPS แบบ real-time
- 🎯 **Flexible Configuration**: ปรับแต่งพารามิเตอร์การทดสอบได้หลากหลาย
- 📈 **Comprehensive Analytics**: วิเคราะห์ performance และ cost ครบถ้วน
- 🔧 **CLI Interface**: ใช้งานง่ายผ่าน command line
- 💾 **Export Results**: บันทึกผลลัพธ์เป็นไฟล์ JSON
- 🛡️ **Error Handling**: จัดการ error และ retry mechanism

## 🛠️ Installation

### Prerequisites

- Node.js >= 18.0.0
- pnpm (แนะนำ) หรือ npm/yarn
- Ethereum wallet พร้อม private key
- Access ไปยัง Ethereum RPC endpoint

### Setup

1. Clone หรือ download โปรเจกต์
2. ติดตั้ง dependencies:

```bash
pnpm install
```

3. Build โปรเจกต์:

```bash
pnpm run build
```

4. สร้างไฟล์ configuration:

```bash
cp .env.example .env
```

5. แก้ไขไฟล์ `.env` ตามความต้องการ

## 🚀 Usage

### Basic Usage

```bash
# รัน load test พื้นฐาน
pnpm run dev test \
  --rpc "https://eth-mainnet.alchemyapi.io/v2/your-api-key" \
  --private-key "your-private-key" \
  --target "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6" \
  --count 100 \
  --concurrency 10
```

### Advanced Usage

```bash
# รัน load test พร้อมการปรับแต่งเพิ่มเติม
pnpm run dev test \
  --rpc "https://eth-goerli.alchemyapi.io/v2/your-api-key" \
  --private-key "your-private-key" \
  --target "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6" \
  --count 500 \
  --concurrency 20 \
  --value 0.001 \
  --gas-limit 21000 \
  --gas-price 20 \
  --duration 600 \
  --verbose \
  --output results.json
```

### Validation

ตรวจสอบ configuration และการเชื่อมต่อก่อนรัน load test:

```bash
pnpm run dev validate \
  --rpc "your-rpc-url" \
  --private-key "your-private-key"
```

## 📋 Command Options

### `test` Command

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `-r, --rpc <url>` | Ethereum RPC URL | - | ✅ |
| `-k, --private-key <key>` | Private key สำหรับส่ง transactions | - | ✅ |
| `-t, --target <address>` | Target address ที่จะส่ง transactions ไป | - | ✅ |
| `-c, --count <number>` | จำนวน transactions ที่จะส่ง | 100 | ❌ |
| `--concurrency <number>` | จำนวน concurrent transactions | 10 | ❌ |
| `-v, --value <amount>` | จำนวน ETH ที่จะส่งต่อ transaction | 0 | ❌ |
| `-g, --gas-limit <limit>` | Gas limit ต่อ transaction | 21000 | ❌ |
| `--gas-price <price>` | Gas price ใน Gwei | auto | ❌ |
| `-d, --duration <seconds>` | ระยะเวลาสูงสุดของการทดสอบ | 300 | ❌ |
| `--verbose` | เปิดใช้งาน verbose logging | false | ❌ |
| `--log-level <level>` | Log level (debug, info, warn, error) | info | ❌ |
| `-o, --output <file>` | บันทึกผลลัพธ์เป็นไฟล์ JSON | - | ❌ |
| `--no-real-time` | ปิดการแสดงสถิติแบบ real-time | false | ❌ |

### `validate` Command

| Option | Description | Required |
|--------|-------------|----------|
| `-r, --rpc <url>` | Ethereum RPC URL | ✅ |
| `-k, --private-key <key>` | Private key สำหรับตรวจสอบ | ✅ |

## 📊 Output Metrics

โปรแกรมจะแสดงผลลัพธ์ดังนี้:

### Transaction Metrics
- **Total Transactions**: จำนวน transactions ทั้งหมด
- **Successful**: จำนวน transactions ที่สำเร็จ
- **Failed**: จำนวน transactions ที่ล้มเหลว
- **Pending**: จำนวน transactions ที่รอการ confirm

### Performance Metrics
- **Average TPS**: TPS เฉลี่ยตลอดการทดสอบ
- **Peak TPS**: TPS สูงสุดที่วัดได้
- **Total Duration**: ระยะเวลาทั้งหมดของการทดสอบ
- **Average Confirmation Time**: เวลาเฉลี่ยในการ confirm transactions

### Cost Analysis
- **Total Gas Used**: จำนวน gas ที่ใช้ทั้งหมด
- **Estimated Cost**: ค่าใช้จ่ายประมาณการใน ETH

### Success Rate
- เปอร์เซ็นต์ความสำเร็จของ transactions

## 🔧 Configuration

### Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```env
RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
PRIVATE_KEY=your-private-key-here
TARGET_ADDRESS=0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6
TRANSACTION_COUNT=100
CONCURRENCY=10
VALUE=0
GAS_LIMIT=21000
GAS_PRICE=20
MAX_DURATION=300
LOG_LEVEL=info
VERBOSE=false
```

## 🏗️ Project Structure

```
src/
├── lib/
│   ├── transaction-sender.ts    # Core transaction sending logic
│   └── load-tester.ts          # Load testing and metrics
├── types/
│   └── index.ts                # TypeScript type definitions
└── index.ts                    # CLI interface
```

## 🧪 Testing

```bash
# รัน unit tests
pnpm test

# รัน tests พร้อม coverage
pnpm test -- --coverage
```

## 🚨 Security Considerations

⚠️ **คำเตือนด้านความปลอดภัย**:

1. **Private Key**: ไม่เคย commit private key เข้า version control
2. **Testnet First**: ทดสอบบน testnet ก่อนใช้งานจริง
3. **Balance Check**: ตรวจสอบ balance ก่อนรัน load test
4. **Rate Limiting**: ระวัง rate limiting ของ RPC provider
5. **Gas Costs**: คำนวณค่า gas ให้ดีก่อนรัน test จำนวนมาก

## 📝 Examples

### Example 1: Basic Load Test

```bash
pnpm run dev test \
  --rpc "https://eth-goerli.alchemyapi.io/v2/your-api-key" \
  --private-key "0x..." \
  --target "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6" \
  --count 50 \
  --concurrency 5
```

### Example 2: High Throughput Test

```bash
pnpm run dev test \
  --rpc "https://eth-mainnet.alchemyapi.io/v2/your-api-key" \
  --private-key "0x..." \
  --target "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6" \
  --count 1000 \
  --concurrency 50 \
  --gas-price 30 \
  --duration 1800 \
  --output high-throughput-results.json
```

### Example 3: Value Transfer Test

```bash
pnpm run dev test \
  --rpc "https://eth-goerli.alchemyapi.io/v2/your-api-key" \
  --private-key "0x..." \
  --target "0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6" \
  --count 10 \
  --concurrency 2 \
  --value 0.001 \
  --verbose
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

เครื่องมือนี้สร้างขึ้นเพื่อการทดสอบและการศึกษาเท่านั้น ผู้ใช้ต้องรับผิดชอบต่อการใช้งานและค่าใช้จ่ายที่เกิดขึ้นเอง กรุณาใช้งานอย่างระมัดระวังและทดสอบบน testnet ก่อนใช้งานจริง