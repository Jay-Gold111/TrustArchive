require("../loadEnv").loadEnv();
require("./routes");
require("./aes256gcm");
require("./rbac");
require("./TrustScoreService");
require("./chainVerify");
process.stdout.write("trustconnect ok\n");

