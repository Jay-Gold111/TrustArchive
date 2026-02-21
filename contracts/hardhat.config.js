require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * TrustArchive (MVP) - Hardhat 配置
 *
 * - 合约使用 Solidity + Hardhat
 * - 部署到本地链（localhost:8545）
 * - 部署脚本使用 Hardhat Ignition
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    /**
     * 对接 hardhat node（本地链）
     * 启动方式：npm run node
     */
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337
    }
  }
};
