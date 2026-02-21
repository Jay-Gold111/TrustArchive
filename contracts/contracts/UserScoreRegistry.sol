// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserScoreRegistry {
    address public owner;

    mapping(address => uint256) private _score;
    mapping(address => uint256) private _updatedAt;

    event ScoreUpdated(address indexed user, uint256 score, uint256 updatedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function getScore(address user) external view returns (uint256 score, uint256 updatedAt) {
        return (_score[user], _updatedAt[user]);
    }

    function setScore(address user, uint256 score) external onlyOwner {
        _score[user] = score;
        _updatedAt[user] = block.timestamp;
        emit ScoreUpdated(user, score, block.timestamp);
    }

    function setScores(address[] calldata users, uint256[] calldata scores) external onlyOwner {
        require(users.length == scores.length, "LENGTH_MISMATCH");
        for (uint256 i = 0; i < users.length; i++) {
            _score[users[i]] = scores[i];
            _updatedAt[users[i]] = block.timestamp;
            emit ScoreUpdated(users[i], scores[i], block.timestamp);
        }
    }
}

