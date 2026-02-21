const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const notary = await ethers.getContractAt("Notary", contractAddress);

  const dummyCid = "bafybeigdyrztxsmoke-test-cid-just-for-demo";
  const expiryTime = 0;
  const tx = await notary.createRecord("无标题应急存证", dummyCid, ethers.ZeroAddress, expiryTime);
  await tx.wait();

  const [signer] = await ethers.getSigners();
  const [ids, records] = await notary.getHistory(signer.address);

  console.log("Signer:", signer.address);
  console.log("History length:", records.length);
  console.log("Latest id:", ids[ids.length - 1]);
  console.log("Latest:", records[records.length - 1]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
