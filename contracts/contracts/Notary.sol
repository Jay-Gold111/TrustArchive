// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Notary {
    struct NotaryRecord {
        string title;
        string ipfsHash;
        uint256 blockHeight;
        address initiator;
        address participant;
        bool isFinalized;
        uint256 expiryTime;
    }

    NotaryRecord[] private _records;
    mapping(address => uint256[]) private _historyIds;
    mapping(address => string) private _seedEnvelopes;
    mapping(address => string[]) private _userCategories;

    struct ArchiveFileRecord {
        string cid;
        string nameEnc;
        string categoryEnc;
        string mime;
        uint256 size;
        uint256 createdAt;
    }

    mapping(address => ArchiveFileRecord[]) private _archiveFiles;
    mapping(address => mapping(uint256 => uint256)) private _archiveFileFolderId;
    mapping(address => mapping(uint256 => bool)) private _archiveFileDeleted;

    event RecordCreated(
        uint256 indexed id,
        address indexed initiator,
        address indexed participant,
        string title,
        string ipfsHash,
        uint256 blockHeight,
        uint256 expiryTime,
        bool isFinalized
    );

    event RecordSigned(uint256 indexed id, address indexed participant);
    event SeedEnvelopeUpdated(address indexed user);
    event CategoryAdded(address indexed user, uint256 indexed index, string name);

    event ArchiveFileRecorded(
        address indexed user,
        uint256 indexed id,
        string cid,
        string nameEnc,
        string categoryEnc,
        string mime,
        uint256 size,
        uint256 createdAt
    );
    event FilesMoved(address indexed owner, uint256[] fileIds, uint256 indexed targetFolderId);
    event FilesDeleted(address indexed owner, uint256[] fileIds);
    event FolderDeleted(address indexed user, uint256 indexed folderId, string name);

    function setSeedEnvelope(string calldata _envelope) external {
        require(bytes(_envelope).length > 0, "ENVELOPE_EMPTY");
        _ensureUserCategories(msg.sender);
        _seedEnvelopes[msg.sender] = _envelope;
        emit SeedEnvelopeUpdated(msg.sender);
    }

    function getSeedEnvelope(address _user) external view returns (string memory) {
        return _seedEnvelopes[_user];
    }

    function createRecord(
        string calldata _title,
        string calldata _hash,
        address _participant,
        uint256 _expiryTime
    ) external returns (uint256) {
        if (_participant != address(0)) {
            require(bytes(_title).length > 0, "TITLE_REQUIRED");
        }
        require(bytes(_hash).length > 0, "CID_EMPTY");

        bool finalized = _participant == address(0);
        if (finalized) {
            require(_expiryTime == 0, "EMERGENCY_MUST_PERMANENT");
        }

        if (_expiryTime != 0) {
            require(_expiryTime > block.timestamp, "EXPIRY_INVALID");
        }

        uint256 id = _records.length;

        _records.push(
            NotaryRecord({
                title: _title,
                ipfsHash: _hash,
                blockHeight: block.number,
                initiator: msg.sender,
                participant: _participant,
                isFinalized: finalized,
                expiryTime: _expiryTime
            })
        );

        _historyIds[msg.sender].push(id);
        if (_participant != address(0)) {
            _historyIds[_participant].push(id);
        }

        emit RecordCreated(id, msg.sender, _participant, _title, _hash, block.number, _expiryTime, finalized);
        return id;
    }

    function signRecord(uint256 _id) external {
        require(_id < _records.length, "ID_INVALID");

        NotaryRecord storage record = _records[_id];
        require(record.participant != address(0), "NO_PARTICIPANT");
        require(msg.sender == record.participant, "ONLY_PARTICIPANT");
        require(!record.isFinalized, "ALREADY_FINALIZED");
        require(record.expiryTime == 0 || block.timestamp <= record.expiryTime, "EXPIRED");

        record.isFinalized = true;
        emit RecordSigned(_id, msg.sender);
    }

    function getHistory(
        address _user
    ) external view returns (uint256[] memory ids, NotaryRecord[] memory records) {
        uint256[] storage storedIds = _historyIds[_user];
        uint256 len = storedIds.length;

        ids = new uint256[](len);
        records = new NotaryRecord[](len);

        for (uint256 i = 0; i < len; i++) {
            uint256 id = storedIds[i];
            ids[i] = id;
            records[i] = _records[id];
        }
    }

    function getRecord(uint256 _id) external view returns (NotaryRecord memory) {
        require(_id < _records.length, "ID_INVALID");
        return _records[_id];
    }

    function getMyHistory() external view returns (uint256[] memory ids, NotaryRecord[] memory records) {
        return this.getHistory(msg.sender);
    }

    function recordCount() external view returns (uint256) {
        return _records.length;
    }

    function addFileRecord(
        string calldata _cid,
        string calldata _nameEnc,
        string calldata _categoryEnc,
        string calldata _mime,
        uint256 _size,
        uint256 _createdAt
    ) external returns (uint256) {
        require(bytes(_cid).length > 0, "CID_EMPTY");
        require(bytes(_nameEnc).length > 0, "NAME_EMPTY");
        require(bytes(_categoryEnc).length > 0, "CATEGORY_EMPTY");
        _ensureUserCategories(msg.sender);

        uint256 id = _archiveFiles[msg.sender].length;
        _archiveFiles[msg.sender].push(
            ArchiveFileRecord({
                cid: _cid,
                nameEnc: _nameEnc,
                categoryEnc: _categoryEnc,
                mime: _mime,
                size: _size,
                createdAt: _createdAt
            })
        );
        _archiveFileDeleted[msg.sender][id] = false;
        emit ArchiveFileRecorded(msg.sender, id, _cid, _nameEnc, _categoryEnc, _mime, _size, _createdAt);
        return id;
    }

    function addFileRecordV2(
        string calldata _cid,
        string calldata _nameEnc,
        string calldata _categoryEnc,
        string calldata _mime,
        uint256 _size,
        uint256 _createdAt,
        uint256 _folderId
    ) external returns (uint256) {
        require(bytes(_cid).length > 0, "CID_EMPTY");
        require(bytes(_nameEnc).length > 0, "NAME_EMPTY");
        require(bytes(_categoryEnc).length > 0, "CATEGORY_EMPTY");
        _ensureUserCategories(msg.sender);
        _validateFolderId(msg.sender, _folderId);

        uint256 id = _archiveFiles[msg.sender].length;
        _archiveFiles[msg.sender].push(
            ArchiveFileRecord({
                cid: _cid,
                nameEnc: _nameEnc,
                categoryEnc: _categoryEnc,
                mime: _mime,
                size: _size,
                createdAt: _createdAt
            })
        );
        _archiveFileFolderId[msg.sender][id] = _folderId;
        _archiveFileDeleted[msg.sender][id] = false;
        emit ArchiveFileRecorded(msg.sender, id, _cid, _nameEnc, _categoryEnc, _mime, _size, _createdAt);
        return id;
    }

    function addCategory(string calldata _name) external returns (uint256) {
        bytes memory raw = bytes(_name);
        require(raw.length > 0, "NAME_EMPTY");
        require(raw.length <= 64, "NAME_TOO_LONG");
        _ensureUserCategories(msg.sender);

        string[] storage cats = _userCategories[msg.sender];
        for (uint256 i = 0; i < cats.length; i++) {
            if (keccak256(bytes(cats[i])) == keccak256(raw)) revert("CATEGORY_EXISTS");
        }
        cats.push(_name);
        uint256 idx = cats.length - 1;
        emit CategoryAdded(msg.sender, idx, _name);
        return idx;
    }

    function getUserCategories() external view returns (string[] memory categories) {
        string[] storage stored = _userCategories[msg.sender];
        if (stored.length == 0) {
            categories = new string[](3);
            categories[0] = unicode"证件原件";
            categories[1] = unicode"合同协议";
            categories[2] = unicode"财务资产";
            return categories;
        }
        uint256 nonEmpty = 0;
        for (uint256 i = 0; i < stored.length; i++) {
            if (bytes(stored[i]).length > 0) nonEmpty += 1;
        }
        categories = new string[](nonEmpty);
        uint256 j = 0;
        for (uint256 i = 0; i < stored.length; i++) {
            if (bytes(stored[i]).length == 0) continue;
            categories[j] = stored[i];
            j += 1;
        }
    }

    function getMyFolders() external view returns (uint256[] memory folderIds, string[] memory names) {
        string[] storage stored = _userCategories[msg.sender];
        if (stored.length == 0) {
            folderIds = new uint256[](3);
            names = new string[](3);
            folderIds[0] = 1;
            folderIds[1] = 2;
            folderIds[2] = 3;
            names[0] = unicode"证件原件";
            names[1] = unicode"合同协议";
            names[2] = unicode"财务资产";
            return (folderIds, names);
        }
        uint256 nonEmpty = 0;
        for (uint256 i = 0; i < stored.length; i++) {
            if (bytes(stored[i]).length > 0) nonEmpty += 1;
        }
        folderIds = new uint256[](nonEmpty);
        names = new string[](nonEmpty);
        uint256 j = 0;
        for (uint256 i = 0; i < stored.length; i++) {
            if (bytes(stored[i]).length == 0) continue;
            folderIds[j] = i + 1;
            names[j] = stored[i];
            j += 1;
        }
    }

    function deleteFolder(uint256 folderId) external {
        _ensureUserCategories(msg.sender);
        require(folderId > 3, "DEFAULT_FOLDER");
        uint256 idx = folderId - 1;
        string[] storage cats = _userCategories[msg.sender];
        require(idx < cats.length, "FOLDER_ID_INVALID");
        string memory name = cats[idx];
        require(bytes(name).length > 0, "FOLDER_DELETED");

        uint256 fileCount = _archiveFiles[msg.sender].length;
        for (uint256 i = 0; i < fileCount; i++) {
            if (_archiveFileDeleted[msg.sender][i]) continue;
            if (_archiveFileFolderId[msg.sender][i] == folderId) revert("FOLDER_NOT_EMPTY");
        }

        cats[idx] = "";
        emit FolderDeleted(msg.sender, folderId, name);
    }

    function _ensureUserCategories(address _user) private {
        if (_userCategories[_user].length > 0) return;
        _userCategories[_user].push(unicode"证件原件");
        _userCategories[_user].push(unicode"合同协议");
        _userCategories[_user].push(unicode"财务资产");
    }

    function getMyFiles() external view returns (uint256[] memory ids, ArchiveFileRecord[] memory files) {
        return this.getFiles(msg.sender);
    }

    function getFiles(address _user) external view returns (uint256[] memory ids, ArchiveFileRecord[] memory files) {
        uint256 len = _archiveFiles[_user].length;
        uint256 kept = 0;
        for (uint256 i = 0; i < len; i++) {
            if (!_archiveFileDeleted[_user][i]) kept += 1;
        }
        ids = new uint256[](kept);
        files = new ArchiveFileRecord[](kept);
        uint256 j = 0;
        for (uint256 i = 0; i < len; i++) {
            if (_archiveFileDeleted[_user][i]) continue;
            ids[j] = i;
            files[j] = _archiveFiles[_user][i];
            j += 1;
        }
    }

    function getMyFilesV2()
        external
        view
        returns (uint256[] memory ids, ArchiveFileRecord[] memory files, uint256[] memory folderIds)
    {
        return this.getFilesV2(msg.sender);
    }

    function getFilesV2(
        address _user
    ) external view returns (uint256[] memory ids, ArchiveFileRecord[] memory files, uint256[] memory folderIds) {
        uint256 len = _archiveFiles[_user].length;
        uint256 kept = 0;
        for (uint256 i = 0; i < len; i++) {
            if (!_archiveFileDeleted[_user][i]) kept += 1;
        }
        ids = new uint256[](kept);
        files = new ArchiveFileRecord[](kept);
        folderIds = new uint256[](kept);
        uint256 j = 0;
        for (uint256 i = 0; i < len; i++) {
            if (_archiveFileDeleted[_user][i]) continue;
            ids[j] = i;
            files[j] = _archiveFiles[_user][i];
            folderIds[j] = _archiveFileFolderId[_user][i];
            j += 1;
        }
    }

    function moveFiles(uint256[] calldata fileIds, uint256 targetFolderId) external {
        _ensureUserCategories(msg.sender);
        _validateFolderId(msg.sender, targetFolderId);

        uint256 len = fileIds.length;
        require(len > 0, "EMPTY_FILE_IDS");
        uint256 fileCount = _archiveFiles[msg.sender].length;
        for (uint256 i = 0; i < len; i++) {
            uint256 id = fileIds[i];
            require(id < fileCount, "FILE_ID_INVALID");
            require(!_archiveFileDeleted[msg.sender][id], "FILE_DELETED");
            _archiveFileFolderId[msg.sender][id] = targetFolderId;
        }
        emit FilesMoved(msg.sender, fileIds, targetFolderId);
    }

    function deleteFiles(uint256[] calldata fileIds) external {
        _ensureUserCategories(msg.sender);
        uint256 len = fileIds.length;
        require(len > 0, "EMPTY_FILE_IDS");
        uint256 fileCount = _archiveFiles[msg.sender].length;
        for (uint256 i = 0; i < len; i++) {
            uint256 id = fileIds[i];
            require(id < fileCount, "FILE_ID_INVALID");
            require(!_archiveFileDeleted[msg.sender][id], "FILE_DELETED");
            _archiveFileDeleted[msg.sender][id] = true;
            _archiveFileFolderId[msg.sender][id] = 0;
        }
        emit FilesDeleted(msg.sender, fileIds);
    }

    function _validateFolderId(address _user, uint256 _folderId) private view {
        if (_folderId == 0) return;
        uint256 len = _userCategories[_user].length;
        require(_folderId <= len, "FOLDER_ID_INVALID");
        require(bytes(_userCategories[_user][_folderId - 1]).length > 0, "FOLDER_DELETED");
    }
}
