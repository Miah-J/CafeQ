-- seed.sql
-- Run this against your local PostgreSQL instance to create the initial Admin user
-- Make sure to replace 'your_long_random_pgcrypto_key_here' with the value of PGCRYPTO_KEY in your .env if different.

INSERT INTO users (email, password_hash, role, full_name, phone_number)
VALUES (
    'admin@cafeq.com',
    '$2b$10$2hZ3FPjrxofK18sCDAhHhePEGwcDWyRG2SyXwHmO8aQzgrAT2VTze', -- password is: admin123
    'Admin',
    pgp_sym_encrypt('System Admin', 'your_long_random_pgcrypto_key_here'),
    pgp_sym_encrypt('0700000000', 'your_long_random_pgcrypto_key_here')
) ON CONFLICT (email) DO NOTHING;

-- Map user to administrators table
INSERT INTO administrators (id, department)
SELECT id, 'Administration'
FROM users
WHERE email = 'admin@cafeq.com'
ON CONFLICT (id) DO NOTHING;
