const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs");
const crypto = require("crypto");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const TtsClient = tencentcloud.tts.v20190823.Client;

// 生成唯一 key
function getCacheKey(text, voiceType, modelType) {
  return crypto
    .createHash("md5")
    .update(`${text}|${voiceType}|${modelType}`)
    .digest("hex");
}

exports.main = async (event) => {
  const { text} = event;

  if (!text) {
    throw new Error("text is required");
  }
  const voiceType = 101001;//101018
  const modelType = 1;
  // 防止过长文本撑爆数据库
  if (text.length > 100) {
    throw new Error("text too long for cache");
  }

  const cacheKey = getCacheKey(text, voiceType, modelType);

  // 1️⃣ 查缓存
  const cacheRes = await db
    .collection("tts_cache")
    .doc(cacheKey)
    .get()
    .catch(() => null);

  if (cacheRes && cacheRes.data) {
    console.log("✅ TTS DB cache hit");
    return {
      Audio: cacheRes.data.audio,
      fromCache: true,
    };
  }

  // 2️⃣ 缓存未命中，调用 TTS
  console.log("❌ TTS DB cache miss");

  const clientConfig = {
    credential: {
      secretId: "AKIDeDoO0b7RegWAcrudAUcXFoDQSHuJWXN1",
      secretKey: "KRQEpFKLEzZ0Lfq9OfsxuhHl4JAzoUyM",
    },
    region: "",
    profile: {
      httpProfile: {
        endpoint: "tts.tencentcloudapi.com",
      },
    },
  };

  const client = new TtsClient(clientConfig);

  const ttsRes = await client.TextToVoice({
    Text: text,
    SessionId: Date.now().toString(),
    VoiceType: voiceType,
    ModelType: modelType,
  });

  // 3️⃣ 写入数据库缓存
  await db.collection("tts_cache").add({
    data: {
      _id: cacheKey,
      audio: ttsRes.Audio,
      text,
      voiceType,
      modelType,
      createTime: new Date(),
    },
  });

  return {
    Audio: ttsRes.Audio,
    fromCache: false,
  };
};