// backend/seed-test-users.js
const { Client } = require('pg');
const bcrypt = require('bcrypt');

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
  const cryptoKey = 'your_long_random_pgcrypto_key_here';
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Student
  try {
    const studentUser = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, $3, pgp_sym_encrypt($4, $5), pgp_sym_encrypt($6, $5))
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      ['student@strathmore.edu', passwordHash, 'Student', 'Alice Student', cryptoKey, '0712345678']
    );
    const studentId = studentUser.rows[0].id;
    await client.query(
      `INSERT INTO students (id, student_number)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [studentId, 'SU-12345']
    );
    console.log('Seeded Student: student@strathmore.edu / password123');
  } catch (err) {
    console.error('Error seeding student:', err);
  }

  // 2. Create Cashier
  try {
    const cashierUser = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, $3, pgp_sym_encrypt($4, $5), pgp_sym_encrypt($6, $5))
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      ['cashier@strathmore.edu', passwordHash, 'Cashier', 'John Cashier', cryptoKey, '0787654321']
    );
    const cashierId = cashierUser.rows[0].id;
    await client.query(
      `INSERT INTO cashiers (id, station_number)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [cashierId, 'ST-01']
    );
    console.log('Seeded Cashier: cashier@strathmore.edu / password123');
  } catch (err) {
    console.error('Error seeding cashier:', err);
  }

  // 3. Create ServingStaff
  try {
    const serverUser = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, phone_number)
       VALUES ($1, $2, $3, pgp_sym_encrypt($4, $5), pgp_sym_encrypt($6, $5))
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      ['server@cafeq.com', passwordHash, 'ServingStaff', 'Bob Server', cryptoKey, '0755555555']
    );
    console.log('Seeded ServingStaff: server@cafeq.com / password123');
  } catch (err) {
    console.error('Error seeding serving staff:', err);
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  client.end();
});
