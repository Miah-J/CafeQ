export default () => ({
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:159600@localhost:5432/cafeq',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_long_random_jwt_secret_here',
    expiresIn: '24h',
  },
  pgcrypto: {
    key: process.env.PGCRYPTO_KEY || 'your_long_random_pgcrypto_key_here',
  },
});
