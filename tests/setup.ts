// Runs before each test file (Vitest setupFiles).
// Sets all required env vars before any module import evaluates env.ts.

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '5001';
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/portfolio_test';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-xxxxxxxxxxxxxxxxxxxxxxxxxx';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-xxxxxxxxxxxxxxxxxxxxxxxx';
process.env['JWT_ACCESS_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['OTP_HMAC_SECRET'] = 'test-otp-hmac-secret-xxxxxxxxxxxxxxxxxxxxxxxxx';
process.env['CLIENT_URL'] = 'http://localhost:3000';
process.env['SERVER_URL'] = 'http://localhost:5001';
process.env['CRON_SECRET'] = 'test-cron-secret-xxxxxxxxxx';
process.env['ADMIN_SEED_EMAIL'] = 'admin@test.com';
process.env['ADMIN_SEED_PASSWORD'] = 'Admin123!';
