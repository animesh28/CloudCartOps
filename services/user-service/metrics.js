const promClient = require('prom-client');

// User Service Metrics
const userRegistrations = new promClient.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['status']
});

const userLogins = new promClient.Counter({
  name: 'user_logins_total',
  help: 'Total number of user login attempts',
  labelNames: ['success']
});

const passwordHashingTime = new promClient.Histogram({
  name: 'password_hashing_time_seconds',
  help: 'Time taken to hash passwords',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
});

const jwtVerificationTime = new promClient.Histogram({
  name: 'jwt_verification_time_seconds',
  help: 'Time taken to verify JWT tokens',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1]
});

const userUpdateTime = new promClient.Histogram({
  name: 'user_update_time_seconds',
  help: 'Time taken to update user information',
  buckets: [0.1, 0.5, 1, 2, 5]
});

const databaseConnectionTime = new promClient.Histogram({
  name: 'database_connection_time_seconds',
  help: 'Time to establish database connection',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const userCacheHits = new promClient.Counter({
  name: 'user_cache_hits_total',
  help: 'Total cache hits for user queries'
});

const userCacheMisses = new promClient.Counter({
  name: 'user_cache_misses_total',
  help: 'Total cache misses for user queries'
});

module.exports = {
  userRegistrations,
  userLogins,
  passwordHashingTime,
  jwtVerificationTime,
  userUpdateTime,
  databaseConnectionTime,
  userCacheHits,
  userCacheMisses,
  
  registerMetrics() {
    return [
      userRegistrations,
      userLogins,
      passwordHashingTime,
      jwtVerificationTime,
      userUpdateTime,
      databaseConnectionTime
    ];
  }
};
