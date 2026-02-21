// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICredentialCenterAccess {
    function isInstitution(address institution) external view returns (bool);
    function getInstitution(address institution) external view returns (string memory name_, bool isActive);
}

interface IArchivesRegistry2 {
    function recordForUser(
        address user,
        string calldata cid,
        string calldata category,
        uint256 tokenId,
        string calldata templateId,
        address issuer
    ) external returns (uint256);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC5192 is IERC165 {
    event Locked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract IssuerBatchSBT is IERC721, IERC5192 {
    struct Template {
        address issuer;
        string templateId;
        bool hasPrivateAttachment;
        string schemaCID;
        uint256 createdAt;
        bool isActive;
    }

    struct BatchIssuance {
        bytes32 merkleRoot;
        bytes32 templateIdHash;
        string templateId;
        address issuer;
        string distributionCID;
        uint256 total;
        uint256 claimed;
        uint256 createdAt;
        bool isActive;
    }

    struct TokenData {
        address issuer;
        string issuerName;
        string templateId;
        string attachmentCID;
        bool displayed;
    }

    address public owner;
    ICredentialCenterAccess public credentialCenter;
    IArchivesRegistry2 public archivesRegistry;

    string private _name;
    string private _symbol;

    uint256 private _nextTokenId;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => TokenData) private _tokenData;
    mapping(address => uint256[]) private _ownedTokenIds;
    mapping(uint256 => uint256) private _ownedTokenIndex;

    mapping(bytes32 => Template) private _templates;
    mapping(address => bytes32[]) private _issuerTemplateIds;
    mapping(bytes32 => bool) private _templateExists;

    mapping(bytes32 => BatchIssuance) private _batchesByRoot;
    mapping(address => bytes32[]) private _issuerBatchRoots;
    mapping(bytes32 => bool) private _batchExists;
    mapping(bytes32 => mapping(address => bool)) private _batchClaimed;

    mapping(address => uint256) private _issuerIssuedCount;
    string[] private _batchCIDs;
    bytes32[] private _batchRoots;

    event TemplateCreated(bytes32 indexed templateIdHash, address indexed issuer, string templateId, bool hasPrivateAttachment);
    event TemplateDeactivated(bytes32 indexed templateIdHash, address indexed issuer, string templateId);
    event BatchIssuanceCreated(bytes32 indexed merkleRoot, bytes32 indexed templateIdHash, address indexed issuer, uint256 total);
    event BatchClaimed(bytes32 indexed merkleRoot, address indexed user, uint256 indexed tokenId, string attachmentCID);
    event DisplayUpdated(uint256 indexed tokenId, bool displayed);
    event Burned(uint256 indexed tokenId, address indexed owner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyIssuer() {
        require(credentialCenter.isInstitution(msg.sender), "ONLY_ISSUER");
        _;
    }

    constructor(address credentialCenter_, address archivesRegistry_) {
        owner = msg.sender;
        credentialCenter = ICredentialCenterAccess(credentialCenter_);
        archivesRegistry = IArchivesRegistry2(archivesRegistry_);
        _name = "TrustArchive Batch SBT";
        _symbol = "TABATCH";
        _nextTokenId = 1;
    }

    function setArchivesRegistry(address registry) external onlyOwner {
        archivesRegistry = IArchivesRegistry2(registry);
    }

    function setCredentialCenter(address cc) external onlyOwner {
        credentialCenter = ICredentialCenterAccess(cc);
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IERC721).interfaceId || interfaceId == type(IERC5192).interfaceId;
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        require(_owners[tokenId] != address(0), "TOKEN_NOT_FOUND");
        return true;
    }

    function balanceOf(address owner_) external view override returns (uint256) {
        require(owner_ != address(0), "ZERO_ADDRESS");
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "TOKEN_NOT_FOUND");
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "TOKEN_NOT_FOUND");
        return _tokenURIs[tokenId];
    }

    function getToken(uint256 tokenId) external view returns (TokenData memory) {
        require(_owners[tokenId] != address(0), "TOKEN_NOT_FOUND");
        return _tokenData[tokenId];
    }

    function getMyTokens()
        external
        view
        returns (uint256[] memory ids, TokenData[] memory tokens_, string[] memory uris)
    {
        return getTokensOf(msg.sender);
    }

    function getTokensOf(address user)
        public
        view
        returns (uint256[] memory ids, TokenData[] memory tokens_, string[] memory uris)
    {
        uint256[] storage storedIds = _ownedTokenIds[user];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        tokens_ = new TokenData[](len);
        uris = new string[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            tokens_[i] = _tokenData[id];
            uris[i] = _tokenURIs[id];
        }
    }

    function setDisplayed(uint256 tokenId, bool displayed) external {
        require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
        _tokenData[tokenId].displayed = displayed;
        emit DisplayUpdated(tokenId, displayed);
    }

    function setDisplayedMany(uint256[] calldata tokenIds, bool displayed) external {
        uint256 len = tokenIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
            _tokenData[tokenId].displayed = displayed;
            emit DisplayUpdated(tokenId, displayed);
        }
    }

    function getIssuerStats(address issuer_) external view returns (uint256 templateCount, uint256 issuedCount, uint256 unclaimed) {
        templateCount = _issuerTemplateIds[issuer_].length;
        issuedCount = _issuerIssuedCount[issuer_];
        uint256 sum = 0;
        bytes32[] storage stored = _issuerBatchRoots[issuer_];
        for (uint256 i = 0; i < stored.length; i++) {
            BatchIssuance storage b = _batchesByRoot[stored[i]];
            if (!b.isActive) continue;
            if (b.total > b.claimed) sum += (b.total - b.claimed);
        }
        unclaimed = sum;
    }

    function createTemplate(string calldata templateId, bool hasPrivateAttachment, string calldata schemaCID) external onlyIssuer returns (bytes32) {
        require(bytes(templateId).length > 0, "TEMPLATE_EMPTY");
        bytes32 idHash = keccak256(bytes(templateId));
        require(!_templateExists[idHash], "TEMPLATE_EXISTS");
        _templateExists[idHash] = true;
        _templates[idHash] = Template({
            issuer: msg.sender,
            templateId: templateId,
            hasPrivateAttachment: hasPrivateAttachment,
            schemaCID: schemaCID,
            createdAt: block.timestamp,
            isActive: true
        });
        _issuerTemplateIds[msg.sender].push(idHash);
        emit TemplateCreated(idHash, msg.sender, templateId, hasPrivateAttachment);
        return idHash;
    }

    function deactivateTemplate(string calldata templateId) external onlyIssuer {
        require(bytes(templateId).length > 0, "TEMPLATE_EMPTY");
        bytes32 idHash = keccak256(bytes(templateId));
        require(_templateExists[idHash], "TEMPLATE_NOT_FOUND");
        Template storage t = _templates[idHash];
        require(t.issuer == msg.sender, "ONLY_TEMPLATE_OWNER");
        require(t.isActive, "TEMPLATE_INACTIVE");
        t.isActive = false;
        emit TemplateDeactivated(idHash, msg.sender, templateId);
    }

    function getMyTemplates() external view onlyIssuer returns (bytes32[] memory ids, Template[] memory templates_) {
        bytes32[] storage stored = _issuerTemplateIds[msg.sender];
        uint256 len = stored.length;
        ids = new bytes32[](len);
        templates_ = new Template[](len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 id = stored[i];
            ids[i] = id;
            templates_[i] = _templates[id];
        }
    }

    function createBatchIssuance(
        bytes32 merkleRoot,
        string calldata templateId,
        string calldata distributionCID,
        uint256 total
    ) external onlyIssuer returns (bytes32) {
        require(merkleRoot != bytes32(0), "ROOT_EMPTY");
        require(bytes(templateId).length > 0, "TEMPLATE_EMPTY");
        require(!_batchExists[merkleRoot], "BATCH_EXISTS");
        bytes32 idHash = keccak256(bytes(templateId));
        require(_templateExists[idHash], "TEMPLATE_NOT_FOUND");
        Template storage t = _templates[idHash];
        require(t.issuer == msg.sender, "ONLY_TEMPLATE_OWNER");
        require(t.isActive, "TEMPLATE_INACTIVE");
        require(bytes(distributionCID).length > 0, "DIST_EMPTY");
        require(total > 0, "TOTAL_EMPTY");
        _batchExists[merkleRoot] = true;
        _batchesByRoot[merkleRoot] = BatchIssuance({
            merkleRoot: merkleRoot,
            templateIdHash: idHash,
            templateId: templateId,
            issuer: msg.sender,
            distributionCID: distributionCID,
            total: total,
            claimed: 0,
            createdAt: block.timestamp,
            isActive: true
        });
        _issuerBatchRoots[msg.sender].push(merkleRoot);
        _batchCIDs.push(distributionCID);
        _batchRoots.push(merkleRoot);
        emit BatchIssuanceCreated(merkleRoot, idHash, msg.sender, total);
        return merkleRoot;
    }

    function getMyBatches() external view onlyIssuer returns (bytes32[] memory roots, BatchIssuance[] memory batches) {
        bytes32[] storage stored = _issuerBatchRoots[msg.sender];
        uint256 len = stored.length;
        roots = new bytes32[](len);
        batches = new BatchIssuance[](len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 r = stored[i];
            roots[i] = r;
            batches[i] = _batchesByRoot[r];
        }
    }

    function getBatch(bytes32 merkleRoot) external view returns (BatchIssuance memory) {
        require(_batchExists[merkleRoot], "BATCH_NOT_FOUND");
        return _batchesByRoot[merkleRoot];
    }

    function getBatchCIDs() external view returns (string[] memory) {
        return _batchCIDs;
    }

    function getBatchRoots() external view returns (bytes32[] memory) {
        return _batchRoots;
    }

    function hasClaimed(address user, uint256 batchIndex) external view returns (bool) {
        require(batchIndex < _batchRoots.length, "BATCH_INDEX_OOB");
        bytes32 root = _batchRoots[batchIndex];
        require(_batchExists[root], "BATCH_NOT_FOUND");
        return _batchClaimed[root][user];
    }

    function claim(
        bytes32 merkleRoot,
        string calldata tokenURI_,
        string calldata attachmentCID,
        bytes32[] calldata proof
    ) external returns (uint256) {
        require(_batchExists[merkleRoot], "BATCH_NOT_FOUND");
        BatchIssuance storage b = _batchesByRoot[merkleRoot];
        require(b.isActive, "BATCH_INACTIVE");
        require(!_batchClaimed[merkleRoot][msg.sender], "ALREADY_CLAIMED");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tokenURI_, attachmentCID));
        require(_verifyProofSorted(proof, merkleRoot, leaf), "INVALID_PROOF");

        _batchClaimed[merkleRoot][msg.sender] = true;
        b.claimed += 1;

        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;
        _mint(msg.sender, tokenId);

        (string memory issuerName, ) = credentialCenter.getInstitution(b.issuer);
        _tokenData[tokenId] = TokenData({
            issuer: b.issuer,
            issuerName: issuerName,
            templateId: b.templateId,
            attachmentCID: attachmentCID,
            displayed: false
        });
        _tokenURIs[tokenId] = tokenURI_;
        _issuerIssuedCount[b.issuer] += 1;

        if (bytes(attachmentCID).length > 0 && address(archivesRegistry) != address(0)) {
            archivesRegistry.recordForUser(msg.sender, attachmentCID, unicode"证件原件", tokenId, b.templateId, b.issuer);
        }

        emit BatchClaimed(merkleRoot, msg.sender, tokenId, attachmentCID);
        emit Locked(tokenId);
        return tokenId;
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
        _burn(tokenId);
        emit Burned(tokenId, msg.sender);
    }

    function burnMany(uint256[] calldata tokenIds) external {
        uint256 len = tokenIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
            _burn(tokenId);
            emit Burned(tokenId, msg.sender);
        }
    }

    function approve(address, uint256) external pure override {
        revert("SBT_NON_TRANSFERABLE");
    }

    function getApproved(uint256) external pure override returns (address) {
        return address(0);
    }

    function setApprovalForAll(address, bool) external pure override {
        revert("SBT_NON_TRANSFERABLE");
    }

    function isApprovedForAll(address, address) external pure override returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure override {
        revert("SBT_NON_TRANSFERABLE");
    }

    function safeTransferFrom(address, address, uint256) external pure override {
        revert("SBT_NON_TRANSFERABLE");
    }

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "ZERO_ADDRESS");
        require(_owners[tokenId] == address(0), "TOKEN_EXISTS");
        _owners[tokenId] = to;
        _balances[to] += 1;
        _ownedTokenIndex[tokenId] = _ownedTokenIds[to].length;
        _ownedTokenIds[to].push(tokenId);
        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal {
        address o = _owners[tokenId];
        require(o != address(0), "TOKEN_NOT_FOUND");

        uint256 idx = _ownedTokenIndex[tokenId];
        uint256 lastIdx = _ownedTokenIds[o].length - 1;
        if (idx != lastIdx) {
            uint256 lastTokenId = _ownedTokenIds[o][lastIdx];
            _ownedTokenIds[o][idx] = lastTokenId;
            _ownedTokenIndex[lastTokenId] = idx;
        }
        _ownedTokenIds[o].pop();
        delete _ownedTokenIndex[tokenId];

        _balances[o] -= 1;
        delete _owners[tokenId];
        delete _tokenData[tokenId];
        delete _tokenURIs[tokenId];

        emit Transfer(o, address(0), tokenId);
    }

    function _verifyProofSorted(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }
}
