// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);

    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);

    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
}

interface IERC5192 is IERC165 {
    event Locked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract CredentialCenter is IERC721, IERC5192 {
    struct IssuerApplication {
        address applicant;
        string metadataCID;
        uint256 createdAt;
        uint8 status; // 0=pending,1=approved,2=rejected
    }

    struct Institution {
        string name;
        bool isActive;
    }

    struct Offer {
        address issuer;
        address student;
        string issuerName;
        string title;
        uint8 category;
        string publicImageCid;
        string attachmentCid;
        uint256 createdAt;
        uint8 status; // 0=pending,1=accepted,2=rejected
    }

    struct Claim {
        address institution;
        address student;
        string institutionName;
        string title;
        uint8 category;
        string reviewCid;
        string privateCid;
        uint256 createdAt;
        uint256 decidedAt;
        uint256 tokenId;
        uint8 status; // 0=pending,1=approved,2=rejected
        string rejectReason;
    }

    struct TokenData {
        uint256 offerId;
        address issuer;
        string issuerName;
        string title;
        uint8 category;
        string publicImageCid;
        string privateCid;
        bool displayed;
    }

    string private _name;
    string private _symbol;
    address public owner;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    mapping(address => Institution) private _institutions;
    address[] private _institutionAddrs;
    mapping(address => uint256) private _issuerMintedCount;

    mapping(address => mapping(address => bool)) private _blockedIssuer;
    mapping(address => address[]) private _blockedIssuers;
    mapping(address => mapping(address => uint256)) private _blockedIssuerIndexPlusOne;

    uint256 private _offerCount;
    mapping(uint256 => Offer) private _offers;
    mapping(address => uint256[]) private _studentOfferIds;

    uint256 private _claimCount;
    mapping(uint256 => Claim) private _claims;
    mapping(address => uint256[]) private _studentClaimIds;
    mapping(address => uint256[]) private _pendingClaimIds;
    mapping(uint256 => uint256) private _pendingClaimIndex;

    uint256 private _nextTokenId;
    mapping(uint256 => TokenData) private _tokenData;
    mapping(address => uint256[]) private _ownedTokenIds;
    mapping(uint256 => uint256) private _ownedTokenIndex;

    event InstitutionAuthorized(address indexed institution, string name);
    event InstitutionRevoked(address indexed institution);
    event OfferIssued(uint256 indexed offerId, address indexed issuer, address indexed student);
    event OfferAccepted(uint256 indexed offerId, uint256 indexed tokenId, address indexed student);
    event OfferRejected(uint256 indexed offerId, address indexed student, bool blocked);
    event IssuerBlocked(address indexed student, address indexed issuer);
    event IssuerUnblocked(address indexed student, address indexed issuer);
    event DisplayUpdated(uint256 indexed tokenId, bool displayed);
    event ClaimSubmitted(uint256 indexed claimId, address indexed institution, address indexed student);
    event ClaimRejected(uint256 indexed claimId, address indexed institution, address indexed student, string reason);
    event ClaimApproved(uint256 indexed claimId, uint256 indexed tokenId, address indexed student);

    event IssuerApplied(uint256 indexed applicationId, address indexed applicant, string metadataCID);
    event IssuerApproved(uint256 indexed applicationId, address indexed applicant);
    event IssuerRejected(uint256 indexed applicationId, address indexed applicant, string reason);

    uint256 private _issuerApplicationCount;
    mapping(uint256 => IssuerApplication) private _issuerApplications;
    mapping(address => uint256) private _issuerApplicationIdOf;
    mapping(uint256 => uint256) private _issuerApplicationIndex;
    uint256[] private _issuerApplicationIds;

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyInstitution() {
        require(_institutions[msg.sender].isActive, "ONLY_INSTITUTION");
        _;
    }

    constructor() {
        owner = msg.sender;
        _name = "TrustArchive Credential SBT";
        _symbol = "TACRED";
        _nextTokenId = 1;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC5192).interfaceId;
    }

    function balanceOf(address account) external view override returns (uint256) {
        require(account != address(0), "ZERO_ADDRESS");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "TOKEN_NOT_FOUND");
        return o;
    }

    function approve(address, uint256) external pure override {
        revert("SOULBOUND");
    }

    function getApproved(uint256) external pure override returns (address) {
        return address(0);
    }

    function setApprovalForAll(address, bool) external pure override {
        revert("SOULBOUND");
    }

    function isApprovedForAll(address, address) external pure override returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure override {
        revert("SOULBOUND");
    }

    function safeTransferFrom(address, address, uint256) external pure override {
        revert("SOULBOUND");
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure override {
        revert("SOULBOUND");
    }

    function locked(uint256 tokenId) external view override returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function authorizeInstitution(address institution, string calldata name_) external onlyOwner {
        require(institution != address(0), "ZERO_ADDRESS");
        require(bytes(name_).length > 0, "NAME_EMPTY");

        if (bytes(_institutions[institution].name).length == 0) {
            _institutionAddrs.push(institution);
        }

        _institutions[institution] = Institution({ name: name_, isActive: true });
        emit InstitutionAuthorized(institution, name_);
    }

    function revokeInstitution(address institution) external onlyOwner {
        require(institution != address(0), "ZERO_ADDRESS");
        _institutions[institution].isActive = false;
        emit InstitutionRevoked(institution);
    }

    function getInstitution(address institution) external view returns (string memory name_, bool isActive) {
        Institution storage inst = _institutions[institution];
        return (inst.name, inst.isActive);
    }

    function listInstitutions()
        external
        view
        returns (address[] memory addrs, string[] memory names, bool[] memory actives)
    {
        uint256 len = _institutionAddrs.length;
        addrs = new address[](len);
        names = new string[](len);
        actives = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            address a = _institutionAddrs[i];
            Institution storage inst = _institutions[a];
            addrs[i] = a;
            names[i] = inst.name;
            actives[i] = inst.isActive;
        }
    }

    function isInstitution(address institution) external view returns (bool) {
        return _institutions[institution].isActive;
    }

    function getIssuerMintedCount(address issuer) external view returns (uint256) {
        return _issuerMintedCount[issuer];
    }

    function _removeIssuerApplicationFromList(uint256 id) internal {
        uint256 len = _issuerApplicationIds.length;
        if (len == 0) return;

        uint256 idx = _issuerApplicationIndex[id];
        if (idx >= len || _issuerApplicationIds[idx] != id) {
            bool found = false;
            for (uint256 i = 0; i < len; i++) {
                if (_issuerApplicationIds[i] == id) {
                    idx = i;
                    found = true;
                    break;
                }
            }
            if (!found) return;
        }

        uint256 lastIndex = len - 1;
        if (idx != lastIndex) {
            uint256 lastId = _issuerApplicationIds[lastIndex];
            _issuerApplicationIds[idx] = lastId;
            _issuerApplicationIndex[lastId] = idx;
        }
        _issuerApplicationIds.pop();
        delete _issuerApplicationIndex[id];
    }

    function _deleteIssuerApplication(uint256 id) internal {
        IssuerApplication storage app = _issuerApplications[id];
        address applicant = app.applicant;
        if (applicant != address(0) && _issuerApplicationIdOf[applicant] == id) {
            delete _issuerApplicationIdOf[applicant];
        }
        _removeIssuerApplicationFromList(id);
        delete _issuerApplications[id];
    }

    function applyForIssuer(string calldata metadataCID) external returns (uint256) {
        require(bytes(metadataCID).length > 0, "METADATA_EMPTY");
        require(!_institutions[msg.sender].isActive, "ALREADY_ISSUER");

        uint256 existing = _issuerApplicationIdOf[msg.sender];
        if (existing != 0) {
            IssuerApplication storage app = _issuerApplications[existing];
            if (app.status == 0) {
                app.metadataCID = metadataCID;
                emit IssuerApplied(existing, msg.sender, metadataCID);
                return existing;
            }
            _deleteIssuerApplication(existing);
        }

        _issuerApplicationCount += 1;
        uint256 id = _issuerApplicationCount;
        _issuerApplications[id] = IssuerApplication({
            applicant: msg.sender,
            metadataCID: metadataCID,
            createdAt: block.timestamp,
            status: 0
        });
        _issuerApplicationIdOf[msg.sender] = id;
        _issuerApplicationIndex[id] = _issuerApplicationIds.length;
        _issuerApplicationIds.push(id);
        emit IssuerApplied(id, msg.sender, metadataCID);
        return id;
    }

    function getMyIssuerApplication() external view returns (uint256 id, IssuerApplication memory application) {
        id = _issuerApplicationIdOf[msg.sender];
        if (id == 0) {
            application = IssuerApplication({ applicant: address(0), metadataCID: "", createdAt: 0, status: 0 });
            return (0, application);
        }
        application = _issuerApplications[id];
    }

    function getIssuerApplications()
        external
        view
        onlyOwner
        returns (uint256[] memory ids, IssuerApplication[] memory applications)
    {
        uint256 len = _issuerApplicationIds.length;
        ids = new uint256[](len);
        applications = new IssuerApplication[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = _issuerApplicationIds[i];
            ids[i] = id;
            applications[i] = _issuerApplications[id];
        }
    }

    function approveIssuer(address applicant) external onlyOwner {
        require(applicant != address(0), "ZERO_ADDRESS");
        uint256 id = _issuerApplicationIdOf[applicant];
        require(id != 0, "NO_APPLICATION");
        IssuerApplication storage app = _issuerApplications[id];
        require(app.status == 0, "APPLICATION_FINALIZED");
        app.status = 1;

        string memory currentName = _institutions[applicant].name;
        if (bytes(currentName).length == 0) {
            _institutionAddrs.push(applicant);
            currentName = "Approved Issuer";
        }
        _institutions[applicant] = Institution({ name: currentName, isActive: true });
        emit InstitutionAuthorized(applicant, currentName);
        emit IssuerApproved(id, applicant);
        _deleteIssuerApplication(id);
    }

    function rejectIssuer(address applicant, string calldata reason) external onlyOwner {
        require(applicant != address(0), "ZERO_ADDRESS");
        uint256 id = _issuerApplicationIdOf[applicant];
        require(id != 0, "NO_APPLICATION");
        IssuerApplication storage app = _issuerApplications[id];
        require(app.status == 0, "APPLICATION_FINALIZED");
        app.status = 2;
        emit IssuerRejected(id, applicant, reason);
        _deleteIssuerApplication(id);
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        require(offerId < _offerCount, "OFFER_NOT_FOUND");
        return _offers[offerId];
    }

    function isBlocked(address student, address issuer) external view returns (bool) {
        return _blockedIssuer[student][issuer];
    }

    function blockIssuer(address issuer) external {
        _blockIssuer(msg.sender, issuer);
    }

    function unblockIssuer(address issuer) external {
        _unblockIssuer(msg.sender, issuer);
    }

    function getMyBlockedIssuers() external view returns (address[] memory issuers) {
        address[] storage stored = _blockedIssuers[msg.sender];
        uint256 len = stored.length;
        issuers = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            issuers[i] = stored[i];
        }
    }

    function issueOffer(
        address student,
        string calldata title,
        uint8 category,
        string calldata publicImageCid,
        string calldata attachmentCid
    ) external onlyInstitution returns (uint256) {
        require(student != address(0), "ZERO_ADDRESS");
        require(!_blockedIssuer[student][msg.sender], "BLOCKED");
        require(bytes(title).length > 0, "TITLE_EMPTY");
        require(bytes(publicImageCid).length > 0, "PUBLIC_CID_EMPTY");
        require(bytes(attachmentCid).length > 0, "ATTACHMENT_CID_EMPTY");

        uint256 offerId = _offerCount;
        _offerCount += 1;

        _offers[offerId] = Offer({
            issuer: msg.sender,
            student: student,
            issuerName: _institutions[msg.sender].name,
            title: title,
            category: category,
            publicImageCid: publicImageCid,
            attachmentCid: attachmentCid,
            createdAt: block.timestamp,
            status: 0
        });

        _studentOfferIds[student].push(offerId);
        emit OfferIssued(offerId, msg.sender, student);
        return offerId;
    }

    function submitClaim(
        address institution,
        string calldata title,
        uint8 category,
        string calldata reviewCid,
        string calldata privateCid
    ) external returns (uint256) {
        require(institution != address(0), "ZERO_ADDRESS");
        require(_institutions[institution].isActive, "ONLY_INSTITUTION");
        require(!_blockedIssuer[msg.sender][institution], "BLOCKED");
        require(bytes(title).length > 0, "TITLE_EMPTY");
        require(bytes(reviewCid).length > 0, "REVIEW_CID_EMPTY");
        require(bytes(privateCid).length > 0, "PRIVATE_CID_EMPTY");

        uint256 claimId = _claimCount;
        _claimCount += 1;

        _claims[claimId] = Claim({
            institution: institution,
            student: msg.sender,
            institutionName: _institutions[institution].name,
            title: title,
            category: category,
            reviewCid: reviewCid,
            privateCid: privateCid,
            createdAt: block.timestamp,
            decidedAt: 0,
            tokenId: 0,
            status: 0,
            rejectReason: ""
        });

        _studentClaimIds[msg.sender].push(claimId);
        _pendingClaimIndex[claimId] = _pendingClaimIds[institution].length;
        _pendingClaimIds[institution].push(claimId);

        emit ClaimSubmitted(claimId, institution, msg.sender);
        return claimId;
    }

    function getMyClaims() external view returns (uint256[] memory ids, Claim[] memory claims_) {
        uint256[] storage storedIds = _studentClaimIds[msg.sender];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        claims_ = new Claim[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            claims_[i] = _claims[id];
        }
    }

    function getPendingClaims()
        external
        view
        onlyInstitution
        returns (uint256[] memory ids, Claim[] memory claims_)
    {
        uint256[] storage storedIds = _pendingClaimIds[msg.sender];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        claims_ = new Claim[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            claims_[i] = _claims[id];
        }
    }

    function rejectClaim(uint256 claimId, string calldata reason) external onlyInstitution {
        Claim storage c = _claims[claimId];
        require(c.status == 0, "NOT_PENDING");
        require(c.institution == msg.sender, "ONLY_INSTITUTION");
        require(bytes(reason).length > 0, "REASON_EMPTY");

        c.status = 2;
        c.decidedAt = block.timestamp;
        c.rejectReason = reason;
        c.reviewCid = "";
        c.privateCid = "";

        _removePendingClaim(claimId);
        emit ClaimRejected(claimId, msg.sender, c.student, reason);
    }

    function approveClaimAndMint(
        uint256 claimId,
        string calldata publicImageCid,
        bool displayed
    ) external onlyInstitution returns (uint256) {
        Claim storage c = _claims[claimId];
        require(c.status == 0, "NOT_PENDING");
        require(c.institution == msg.sender, "ONLY_INSTITUTION");
        require(bytes(publicImageCid).length > 0, "PUBLIC_CID_EMPTY");

        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;
        _mint(c.student, tokenId);

        _tokenData[tokenId] = TokenData({
            offerId: claimId,
            issuer: msg.sender,
            issuerName: c.institutionName,
            title: c.title,
            category: c.category,
            publicImageCid: publicImageCid,
            privateCid: c.privateCid,
            displayed: displayed
        });

        _ownedTokenIndex[tokenId] = _ownedTokenIds[c.student].length;
        _ownedTokenIds[c.student].push(tokenId);

        c.status = 1;
        c.decidedAt = block.timestamp;
        c.tokenId = tokenId;
        c.reviewCid = "";
        c.privateCid = "";

        _removePendingClaim(claimId);

        emit ClaimApproved(claimId, tokenId, c.student);
        emit Locked(tokenId);
        _issuerMintedCount[msg.sender] += 1;
        return tokenId;
    }

    function getOffersFor(
        address student
    ) external view returns (uint256[] memory ids, Offer[] memory offers_) {
        uint256[] storage storedIds = _studentOfferIds[student];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        offers_ = new Offer[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            offers_[i] = _offers[id];
        }
    }

    function rejectOffer(uint256 offerId, bool shouldBlock) external {
        Offer storage offer = _offers[offerId];
        require(offer.student == msg.sender, "ONLY_STUDENT");
        require(offer.status == 0, "NOT_PENDING");

        offer.status = 2;
        if (shouldBlock) {
            _blockIssuer(msg.sender, offer.issuer);
        }

        emit OfferRejected(offerId, msg.sender, shouldBlock);
    }

    function acceptOffer(uint256 offerId, string calldata privateCid, bool displayed) external returns (uint256) {
        Offer storage offer = _offers[offerId];
        require(offer.student == msg.sender, "ONLY_STUDENT");
        require(offer.status == 0, "NOT_PENDING");
        require(bytes(privateCid).length > 0, "PRIVATE_CID_EMPTY");

        offer.status = 1;

        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;
        _mint(msg.sender, tokenId);

        _tokenData[tokenId] = TokenData({
            offerId: offerId,
            issuer: offer.issuer,
            issuerName: offer.issuerName,
            title: offer.title,
            category: offer.category,
            publicImageCid: offer.publicImageCid,
            privateCid: privateCid,
            displayed: displayed
        });

        _ownedTokenIndex[tokenId] = _ownedTokenIds[msg.sender].length;
        _ownedTokenIds[msg.sender].push(tokenId);

        emit OfferAccepted(offerId, tokenId, msg.sender);
        emit Locked(tokenId);
        _issuerMintedCount[offer.issuer] += 1;
        return tokenId;
    }

    function getToken(uint256 tokenId) external view returns (TokenData memory) {
        require(_owners[tokenId] != address(0), "TOKEN_NOT_FOUND");
        return _tokenData[tokenId];
    }

    function getMyTokens() external view returns (uint256[] memory ids, TokenData[] memory tokens_) {
        uint256[] storage storedIds = _ownedTokenIds[msg.sender];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        tokens_ = new TokenData[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            tokens_[i] = _tokenData[id];
        }
    }

    function getTokensOf(address user) external view returns (uint256[] memory ids, TokenData[] memory tokens_) {
        uint256[] storage storedIds = _ownedTokenIds[user];
        uint256 len = storedIds.length;
        ids = new uint256[](len);
        tokens_ = new TokenData[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            tokens_[i] = _tokenData[id];
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

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
        _burn(tokenId);
    }

    function burnMany(uint256[] calldata tokenIds) external {
        uint256 len = tokenIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "ONLY_TOKEN_OWNER");
            _burn(tokenId);
        }
    }

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "ZERO_ADDRESS");
        require(_owners[tokenId] == address(0), "TOKEN_EXISTS");
        _owners[tokenId] = to;
        _balances[to] += 1;
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

        emit Transfer(o, address(0), tokenId);
    }

    function _removePendingClaim(uint256 claimId) internal {
        address inst = _claims[claimId].institution;
        uint256 idx = _pendingClaimIndex[claimId];
        uint256 lastIdx = _pendingClaimIds[inst].length - 1;
        if (idx != lastIdx) {
            uint256 lastId = _pendingClaimIds[inst][lastIdx];
            _pendingClaimIds[inst][idx] = lastId;
            _pendingClaimIndex[lastId] = idx;
        }
        _pendingClaimIds[inst].pop();
        delete _pendingClaimIndex[claimId];
    }

    function _blockIssuer(address student, address issuer) internal {
        require(issuer != address(0), "ZERO_ADDRESS");
        if (_blockedIssuer[student][issuer]) return;
        _blockedIssuer[student][issuer] = true;
        if (_blockedIssuerIndexPlusOne[student][issuer] == 0) {
            _blockedIssuers[student].push(issuer);
            _blockedIssuerIndexPlusOne[student][issuer] = _blockedIssuers[student].length;
        }
        emit IssuerBlocked(student, issuer);
    }

    function _unblockIssuer(address student, address issuer) internal {
        require(issuer != address(0), "ZERO_ADDRESS");
        if (!_blockedIssuer[student][issuer]) return;
        _blockedIssuer[student][issuer] = false;

        uint256 idxPlusOne = _blockedIssuerIndexPlusOne[student][issuer];
        if (idxPlusOne > 0) {
            uint256 idx = idxPlusOne - 1;
            uint256 lastIdx = _blockedIssuers[student].length - 1;
            if (idx != lastIdx) {
                address lastIssuer = _blockedIssuers[student][lastIdx];
                _blockedIssuers[student][idx] = lastIssuer;
                _blockedIssuerIndexPlusOne[student][lastIssuer] = idx + 1;
            }
            _blockedIssuers[student].pop();
            delete _blockedIssuerIndexPlusOne[student][issuer];
        }

        emit IssuerUnblocked(student, issuer);
    }
}
