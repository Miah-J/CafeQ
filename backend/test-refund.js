const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { RefundService } = require('./dist/refund/refund.service');
const { Client } = require('pg');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const refundService = app.get(RefundService);

  const fs = require('fs');
  const path = require('path');

  // Load environment variables from root .env if it exists
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:khillon@localhost:5432/cafeq' });
  await client.connect();
  
  // Make a test order with valid UUID
  const oIns = await client.query(`
    INSERT INTO orders (user_id, total_amount, status)
    VALUES ('873c22b6-aa3e-4f88-afe9-6033d3be9123', 250.00, 'CONFIRMED')
    RETURNING id
  `);
  const orderId = oIns.rows[0].id;
  console.log('Created test order UUID:', orderId);

  await client.query(`
    INSERT INTO order_items (order_id, dish_id, quantity, unit_price, status)
    VALUES ($1, '2463178c-60e1-4904-9037-7d6a22180609', 1, 250.00, 'PENDING')
  `, [orderId]);

  await client.query(`
    INSERT INTO payments (order_id, user_id, amount, method, status)
    VALUES ($1, '873c22b6-aa3e-4f88-afe9-6033d3be9123', 250.00, 'WALLET', 'COMPLETED')
  `, [orderId]);

  console.log('Triggering refund processing...');
  const stats = await refundService.processUncollectedRefunds();
  console.log('Stats from trigger:', stats);

  // Query order and items after refund
  const oRes = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  const oiRes = await client.query('SELECT status FROM order_items WHERE order_id = $1', [orderId]);
  
  console.log('Order status after refund:', oRes.rows);
  console.log('Order items status after refund:', oiRes.rows);

  // Cleanup
  await client.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
  await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  await client.query('DELETE FROM orders WHERE id = $1', [orderId]);

  await client.end();
  await app.close();
}

main().catch(console.error);
