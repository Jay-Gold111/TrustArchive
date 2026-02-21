export const USER_SCORE_REGISTRY_ABI = [
  "function owner() external view returns (address)",
  "function getScore(address user) external view returns (uint256 score, uint256 updatedAt)",
  "function setScore(address user, uint256 score) external",
  "function setScores(address[] users, uint256[] scores) external",
  "event ScoreUpdated(address indexed user, uint256 score, uint256 updatedAt)"
];

