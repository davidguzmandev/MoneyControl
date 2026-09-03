module.exports = {
  apps: [
    {
      name: "moneycontrol-backend",
      script: "dist/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
  ],
};
