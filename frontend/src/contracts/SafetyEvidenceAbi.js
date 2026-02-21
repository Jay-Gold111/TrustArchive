/**
 * 为了让 MVP 更“即插即用”，这里使用 Ethers 的“人类可读 ABI”。
 * 好处：
 * - 不依赖 Hardhat 编译产物拷贝到前端
 * - Demo 场景更省事
 *
 * 你也可以在后续迭代中改为：
 * - 从 contracts/artifacts 复制 JSON ABI 到前端
 * - 或者写一个脚本自动导出 ABI + 部署地址
 */
export const SAFETY_EVIDENCE_ABI = [
  "function recordEvidence(string _hash) external",
  "function getHistory(address _user) external view returns (tuple(string ipfsHash,uint256 timestamp,address uploader)[])",
  "event EvidenceRecorded(address indexed user, string ipfsHash, uint256 timestamp)"
];

