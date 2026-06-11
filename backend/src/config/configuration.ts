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
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey:
      process.env.MPESA_PASSKEY ||
      'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72dec1144c9f3',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    callbackUrl:
      process.env.MPESA_CALLBACK_URL ||
      'http://localhost:3001/payments/mpesa/callback',
    simulate: process.env.MPESA_SIMULATE === 'true',
  },
  sms: {
    apiKey: process.env.SMS_API_KEY,
    username: process.env.SMS_USERNAME || 'sandbox',
  },
});
