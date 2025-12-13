module.exports = {
  apps: [{
    name: 'boutique-pos',
    script: 'C:\\Users\\vishu\\AppData\\Roaming\\npm\\node_modules\\bun\\bin\\bun.exe',
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