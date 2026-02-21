export const ARCHIVES_REGISTRY_ABI = [
  "function owner() external view returns (address)",
  "function credentialCenter() external view returns (address)",
  "function getMyArchiveRefs() external view returns (uint256[] ids, tuple(address user,string cid,string category,uint256 createdAt,uint256 tokenId,string templateId,address issuer)[] refs)",
  "function getArchiveRefs(address user) external view returns (uint256[] ids, tuple(address user,string cid,string category,uint256 createdAt,uint256 tokenId,string templateId,address issuer)[] refs)",
  "event ArchiveRecorded(address indexed user, uint256 indexed index, string cid, string category, uint256 tokenId)"
];

