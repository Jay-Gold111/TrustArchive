import CryptoJS from "crypto-js";
import { PinataSDK } from "pinata-web3";

export function generateMasterSeedHex() {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

export function createSeedEnvelope({ personalPassword, masterSeedHex, iterations = 120000 }) {
  const password = typeof personalPassword === "string" ? personalPassword : "";
  const seedHex = typeof masterSeedHex === "string" ? masterSeedHex : "";
  if (!password) throw new Error("个人密码不能为空");
  if (!seedHex) throw new Error("Master Seed 为空");

  const salt = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256
  });
  const iv = CryptoJS.lib.WordArray.random(16);
  const cipher = CryptoJS.AES.encrypt(seedHex, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });

  return {
    v: 1,
    kdf: "pbkdf2-sha256",
    iterations,
    saltHex: salt.toString(CryptoJS.enc.Hex),
    ivHex: iv.toString(CryptoJS.enc.Hex),
    ciphertext: cipher.toString()
  };
}

export function openSeedEnvelope({ personalPassword, envelope }) {
  const password = typeof personalPassword === "string" ? personalPassword : "";
  if (!password) throw new Error("个人密码不能为空");
  if (!envelope || typeof envelope !== "object") throw new Error("缺少种子信封");

  const iterations = Number(envelope.iterations) || 0;
  const saltHex = String(envelope.saltHex || "");
  const ivHex = String(envelope.ivHex || "");
  const ciphertext = String(envelope.ciphertext || "");
  if (!iterations || !saltHex || !ivHex || !ciphertext) throw new Error("种子信封格式无效");

  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256
  });
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const plain = CryptoJS.AES.decrypt(ciphertext, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(
    CryptoJS.enc.Utf8
  );

  if (!plain) throw new Error("Incorrect Password");
  return plain;
}

export function deriveFileKey({ masterSeedHex, fileId }) {
  const seedHex = typeof masterSeedHex === "string" ? masterSeedHex : "";
  const id = typeof fileId === "string" ? fileId : "";
  if (!seedHex) throw new Error("Master Seed 为空");
  if (!id) throw new Error("fileId 为空");
  const seed = CryptoJS.enc.Hex.parse(seedHex);
  return CryptoJS.HmacSHA256(id, seed);
}

export function encryptWithDerivedKey({ plainText, key }) {
  if (typeof plainText !== "string" || plainText.length === 0) throw new Error("待加密内容不能为空");
  if (!key) throw new Error("缺少加密密钥");
  const iv = CryptoJS.lib.WordArray.random(16);
  const cipher = CryptoJS.AES.encrypt(plainText, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { ciphertext: cipher.toString(), ivHex: iv.toString(CryptoJS.enc.Hex) };
}

export function decryptWithDerivedKey({ ciphertext, ivHex, key }) {
  if (typeof ciphertext !== "string" || ciphertext.length === 0) throw new Error("密文为空，无法解密");
  if (typeof ivHex !== "string" || ivHex.length === 0) throw new Error("缺少 IV");
  if (!key) throw new Error("缺少解密密钥");
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const plain = CryptoJS.AES.decrypt(ciphertext, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString(
    CryptoJS.enc.Utf8
  );
  if (!plain) throw new Error("解密失败");
  return plain;
}

export function createFileId() {
  const rand = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  return `${Date.now()}-${rand}`;
}

/**
 * encryptData
 * ----------
 * 将用户输入的“安全报告/当前位置”等敏感信息，在客户端使用 AES 进行加密。
 *
 * 为什么要在客户端加密？
 * - 你的明文不应出现在 IPFS（公开网络）上
 * - 你的明文也不应被任何存储服务（Pinata）看到
 * - 链上只记录 CID（指向加密后的内容），实现“可验证存证 + 隐私优先”
 *
 * CryptoJS.AES.encrypt(plainText, password) 的要点：
 * - password 会参与密钥派生（内部会生成 salt）
 * - 返回的字符串包含必要的参数，便于未来用同一 password 解密
 * - 这意味着：只要你自己记住 password，就能在本地解密恢复明文
 */
export function encryptData(plainText, password) {
  if (typeof plainText !== "string" || plainText.trim().length === 0) {
    throw new Error("待加密内容不能为空");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("解密密码不能为空（仅本地使用，不会上链/不上传）");
  }

  const ciphertext = CryptoJS.AES.encrypt(plainText, password).toString();
  return ciphertext;
}

export function decryptData(cipherText, password) {
  if (typeof cipherText !== "string" || cipherText.length === 0) {
    throw new Error("密文为空，无法解密");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("解密密码不能为空");
  }

  const plainText = CryptoJS.AES.decrypt(cipherText, password).toString(CryptoJS.enc.Utf8);

  if (!plainText) {
    throw new Error("密码无效");
  }

  return plainText;
}

export async function fetchEncryptedFromPinataGateway(cid) {
  if (typeof cid !== "string" || cid.trim().length === 0) {
    throw new Error("CID 不能为空");
  }

  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY;
  const gatewayCandidates = [
    ...(pinataGateway ? [`https://${pinataGateway}/ipfs/${cid}`] : []),
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`
  ];

  async function fetchWithTimeout(url, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  let lastError = null;
  let res = null;
  let usedUrl = "";

  for (const url of gatewayCandidates) {
    usedUrl = url;
    try {
      res = await fetchWithTimeout(url);
      if (!res.ok) {
        lastError = new Error(`网关请求失败：${res.status} ${res.statusText}`);
        continue;
      }
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      res = null;
    }
  }

  if (!res) {
    const raw = lastError?.message || String(lastError);
    if (raw.includes("Failed to fetch")) {
      throw new Error(
        "Failed to fetch：浏览器无法访问 IPFS 网关（常见原因：网络/代理/公司防火墙/CORS/浏览器插件拦截）。请先用浏览器直接打开该 CID 的网关链接确认可访问；或在 .env 配置 VITE_PINATA_GATEWAY 使用你的专属网关后重启前端。"
      );
    }
    throw new Error(`无法从 IPFS 网关获取内容：${raw}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    const cipherText = typeof json?.ciphertext === "string" ? json.ciphertext : "";
    return { cipherText, raw: json, url: usedUrl };
  }

  const text = await res.text();
  if (!text) {
    throw new Error("网关返回为空");
  }

  return { cipherText: text, raw: text, url: usedUrl };
}

/**
 * uploadToPinata
 * -------------
 * 将“加密后的数据”以 JSON 的形式上传到 IPFS（通过 Pinata）。
 *
 * 重要说明（MVP/演示向）：
 * - 该示例使用 Pinata JWT 在前端直接调用 Pinata SDK（pinata-web3）
 * - 这适合黑客松 Demo，但不适合生产环境（前端暴露 JWT）
 * - 生产环境应改为：后端签名/临时 token/中间层代理
 *
 * 环境变量（在 frontend/.env 里配置）：
 * - VITE_PINATA_JWT=你的 Pinata JWT
 * - VITE_PINATA_GATEWAY=可选，你的专属网关域名（例如 example-gateway.mypinata.cloud）
 */
export async function uploadToPinata(encryptedData) {
  if (
    !(
      (typeof encryptedData === "string" && encryptedData.length > 0) ||
      (encryptedData && typeof encryptedData === "object")
    )
  ) {
    throw new Error("上传内容不能为空");
  }

  const pinataJwt = import.meta.env.VITE_PINATA_JWT;
  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY;

  if (!pinataJwt) {
    throw new Error("缺少 VITE_PINATA_JWT（请在 frontend/.env 配置）");
  }

  /**
   * JWT 通常长这样：xxxxx.yyyyy.zzzzz（中间有两个点）
   * 如果你填的是“API Key”（通常不包含点），会导致认证失败。
   */
  if (typeof pinataJwt === "string" && pinataJwt.split(".").length < 3) {
    throw new Error(
      "VITE_PINATA_JWT 看起来不是 JWT。请在 Pinata 控制台为你的 Key 生成 JWT（不是 API Key 字符串）。"
    );
  }

  const pinata = new PinataSDK({
    pinataJwt,
    ...(pinataGateway ? { pinataGateway } : {})
  });

  const payload = {
    app: "TrustArchive",
    version: typeof encryptedData === "string" ? 1 : 2,
    createdAt: new Date().toISOString(),
    ...(typeof encryptedData === "string" ? { ciphertext: encryptedData } : encryptedData)
  };

  /**
   * pinata-web3 的 upload.json 会返回类似：
   * { IpfsHash: "bafy...", PinSize: ..., Timestamp: ... }
   *
   * 我们只需要 CID（IpfsHash），用于后续写入合约。
   */
  let result;
  try {
    result = await pinata.upload.json(payload);
  } catch (e) {
    const raw = e?.message || String(e);
    if (raw.includes("NO_SCOPES_FOUND")) {
      throw new Error(
        'Pinata 认证失败：你的 Key/JWT 没有上传所需权限（scopes）。请在 Pinata 创建/编辑 Key 时勾选 IPFS/Pinning 上传相关 scopes（至少允许上传 JSON），然后重新生成 JWT 并重启前端。'
      );
    }
    throw e;
  }
  const cid = result?.IpfsHash || result?.cid;

  if (!cid) {
    throw new Error("Pinata 上传成功但未返回 CID（请检查返回结构）");
  }

  return cid;
}

export async function uploadFileToPinata(file) {
  const pinataJwt = import.meta.env.VITE_PINATA_JWT;
  const pinataGateway = import.meta.env.VITE_PINATA_GATEWAY;

  if (!pinataJwt) {
    throw new Error("缺少 VITE_PINATA_JWT（请在 frontend/.env 配置）");
  }
  if (typeof pinataJwt === "string" && pinataJwt.split(".").length < 3) {
    throw new Error(
      "VITE_PINATA_JWT 看起来不是 JWT。请在 Pinata 控制台为你的 Key 生成 JWT（不是 API Key 字符串）。"
    );
  }

  if (!file) throw new Error("上传文件不能为空");
  if (typeof File !== "undefined" && !(file instanceof File)) {
    throw new Error("上传对象不是 File");
  }

  const pinata = new PinataSDK({
    pinataJwt,
    ...(pinataGateway ? { pinataGateway } : {})
  });

  let result;
  try {
    result = await pinata.upload.file(file);
  } catch (e) {
    const raw = e?.message || String(e);
    if (raw.includes("NO_SCOPES_FOUND")) {
      throw new Error(
        'Pinata 认证失败：你的 Key/JWT 没有上传所需权限（scopes）。请在 Pinata 创建/编辑 Key 时勾选 IPFS/Pinning 上传相关 scopes（允许上传文件），然后重新生成 JWT 并重启前端。'
      );
    }
    throw e;
  }

  const cid = result?.IpfsHash || result?.cid;
  if (!cid) {
    throw new Error("Pinata 上传成功但未返回 CID（请检查返回结构）");
  }
  return cid;
}

export async function unpinFromPinata(cid) {
  const c = typeof cid === "string" ? cid.trim() : "";
  if (!c) throw new Error("缺少 CID");
  const pinataJwt = import.meta.env.VITE_PINATA_JWT;
  if (!pinataJwt) throw new Error("缺少 VITE_PINATA_JWT（请在 frontend/.env 配置）");
  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(c)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${pinataJwt}`
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Unpin 失败（${res.status}）${text ? `: ${text}` : ""}`);
  }
  return true;
}
