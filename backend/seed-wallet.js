// backend/seed-wallet.js
const { Client } = require('pg');

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

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:khillon@localhost:5432/cafeq',
});

async function main() {
  await client.connect();

  try {
    const userRes = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      ['student@strathmore.edu']
    );

    if (userRes.rows.length === 0) {
      console.error('Student user not found');
      await client.end();
      return;
    }

    const userId = userRes.rows[0].id;
    await client.query(
      `INSERT INTO wallets (user_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance`,
      [userId, 5000.00]
    );

    console.log('Successfully set student wallet balance to KES 5000.00');
  } catch (err) {
    console.error('Error seeding wallet:', err);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  client.end();
});
