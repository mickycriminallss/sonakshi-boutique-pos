module.exports = {
  apps: [{
    name: 'boutique-pos',
    script: 'bun',
    args: 'dev',
    cwd: './',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    }
  }]
};
