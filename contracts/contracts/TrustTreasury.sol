// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TrustTreasury is Ownable {
    event DepositReceived(address indexed user, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function deposit() external payable {
        require(msg.value > 0, "amount=0");
        emit DepositReceived(msg.sender, msg.value);
    }

    function withdrawRevenue(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "withdraw failed");
    }
}
