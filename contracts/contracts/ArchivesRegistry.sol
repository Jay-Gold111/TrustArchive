// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArchivesRegistry {
    struct ArchiveRef {
        address user;
        string cid;
        string category;
        uint256 createdAt;
        uint256 tokenId;
        string templateId;
        address issuer;
    }

    address public owner;
    address public credentialCenter;

    mapping(address => ArchiveRef[]) private _userRefs;

    event CredentialCenterUpdated(address indexed credentialCenter);
    event ArchiveRecorded(address indexed user, uint256 indexed index, string cid, string category, uint256 tokenId);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyCredentialCenter() {
        require(msg.sender == credentialCenter, "ONLY_CREDENTIAL_CENTER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCredentialCenter(address cc) external onlyOwner {
        credentialCenter = cc;
        emit CredentialCenterUpdated(cc);
    }

    function recordForUser(
        address user,
        string calldata cid,
        string calldata category,
        uint256 tokenId,
        string calldata templateId,
        address issuer
    ) external onlyCredentialCenter returns (uint256) {
        require(user != address(0), "ZERO_ADDRESS");
        require(bytes(cid).length > 0, "CID_EMPTY");
        uint256 idx = _userRefs[user].length;
        _userRefs[user].push(
            ArchiveRef({
                user: user,
                cid: cid,
                category: category,
                createdAt: block.timestamp,
                tokenId: tokenId,
                templateId: templateId,
                issuer: issuer
            })
        );
        emit ArchiveRecorded(user, idx, cid, category, tokenId);
        return idx;
    }

    function getMyArchiveRefs() external view returns (uint256[] memory ids, ArchiveRef[] memory refs) {
        return getArchiveRefs(msg.sender);
    }

    function getArchiveRefs(address user) public view returns (uint256[] memory ids, ArchiveRef[] memory refs) {
        uint256 len = _userRefs[user].length;
        ids = new uint256[](len);
        refs = new ArchiveRef[](len);
        for (uint256 i = 0; i < len; i++) {
            ids[i] = i;
            refs[i] = _userRefs[user][i];
        }
    }
}

