import forge from "node-forge";

function generateRandomKey(length: number) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function getAiEncryptData(params: { mode: any; data: unknown }) {
  const { mode, data } = params;
  if (mode === "development") {
    return data;
  }
  const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1ITWRl6ePMu7Fhusup2d
FEz/hCRTE5mUIeGIjtezG5g8ewBdTaR2FRxtTFONYTaaSR6yFXm9k74tkS1/i0Z8
7eIV130XydOn4zFhk2sOkG46mQ+lZwJkyVwvMaAOCnHluTIaPMPMV3sYpp3cWspl
2H++R5/kOGVm6EG9HivrimQEKDDJLg9owbfWO2kSEM9ZpUHUt29msYq+lDtBrivG
oodvC8p5H4a/jXKvLtPRGO09ZO3xk1ktS8isc376Ec9L9Zo8wSwaj5Z/Pg7nd7Sa
tqj5BEj3YH8rSr1dg77ZMMH1lsuzdA0NHmRGYEvWnUoD6dMqjJjufNwAw9D47DQH
lwIDAQAB
-----END PUBLIC KEY-----`;

  // 生成一个随机的AES密钥
  const AESKey = generateRandomKey(16);

  // 用AES密钥加密数据
  const cipher = forge.cipher.createCipher("AES-CBC", AESKey);
  cipher.start({ iv: AESKey });
  cipher.update(
    forge.util.createBuffer(forge.util.encodeUtf8(JSON.stringify(data))),
  );
  cipher.finish();
  const encryptedData = forge.util.encode64(cipher.output.getBytes());

  // 使用RSA公钥加密AES密钥
  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY);
  const encryptedAESKey = forge.util.encode64(publicKey.encrypt(AESKey));

  return { chatContent: encryptedData, chatKey: encryptedAESKey };
}

const logger = {
  info(message: string) {
    console.log(
      "%c%s%c %s",
      "background-color: #fa6400; color: #ffffff;padding: 0px 6px",
      "AI-SDK",
      "color: #ffffff",
      message,
    );
  },
};

enum FetchTarget {
  CustomApp = "CustomApp",
  Platform = "Platform",
  Center = "Center",
}

let fetchTaget: FetchTarget;

async function checkFetchTarget(): Promise<FetchTarget> {
  if (fetchTaget) {
    return Promise.resolve(fetchTaget);
  }

  /** 如果安装了自定义的AI服务，请求自定义服务 */
  const hasAICustomApp = await fetch("/api/ai-service/check-config")
    .then((res) => {
      return res.json();
    })
    .then((data: any) => {
      if (data?.code === 1) {
        return true;
      } else {
        return false;
      }
    })
    .catch((e: any) => {
      return false;
    });

  if (hasAICustomApp) {
    logger.info("使用自定义服务");
    return (fetchTaget = FetchTarget.CustomApp);
  }

  /** 如果配置了平台token，请求平台服务 */
  const hasPlatformToken = await fetch("/api/assistant/status")
    .then((res) => {
      return res.json();
    })
    .then((data: any) => {
      if (data?.code === 1) {
        return true;
      } else {
        return false;
      }
    })
    .catch((e: any) => {
      return false;
    });

  if (hasPlatformToken) {
    logger.info("使用平台服务");
    return (fetchTaget = FetchTarget.Platform);
  }

  logger.info("使用AI服务");
  return (fetchTaget = FetchTarget.Center);
}

const transfromExtendParams = (extendParams: { aiRole?: any }) => {
  const { aiRole } = extendParams;
  let model = "google/gemini-2.5-flash";
  let role = "default";

  if (!aiRole) {
    return {
      model,
      role,
    };
  }

  switch (true) {
    case ["image"].includes(aiRole): {
      model = "anthropic/claude-sonnet-4.5";
      role = "image";
      break;
    }
    case ["architect"].includes(aiRole): {
      model = "google/gemini-3-pro-preview";
      role = "architect";
      break;
    }
    case ["expert"].includes(aiRole): {
      model = "anthropic/claude-sonnet-4.5";
      role = "expert";
      break;
    }
    default: {
      role = "default";
      break;
    }
  }

  return {
    model,
    role,
  };
};

const requestAsStream = async (params: {
  messages: any;
  emits: any;
  aiRole?: any;
}) => {
  const { messages, emits, aiRole } = params;
  const { cancel, write, complete, error } = emits;

  // const mode = (window as any)._rxai_request_mybricks_mode_ || "production";
  const mode = 'development'

  if (mode !== "development") {
    await checkFetchTarget();
  }

  const extendParams = transfromExtendParams({ aiRole });

  try {
    const controller = new AbortController();

    let streamUrl = "//ai.mybricks.world/stream-with-tools";
    if (fetchTaget === FetchTarget.CustomApp) {
      streamUrl = "/api/ai-service/stream";
    } else if (fetchTaget === FetchTarget.Platform) {
      streamUrl = "/api/assistant/stream";
    }

    fetch(
      mode === "development" ? "//ai.mybricks.world/stream-test" : streamUrl,
      {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(extendParams.role
            ? {
                "M-Request-Role": extendParams.role,
              }
            : {}),
        },
        body: JSON.stringify(
          mode === "development"
            ? {
                messages,
                ...extendParams,
              }
            : getAiEncryptData({
                mode,
                data: {
                  messages,
                  ...extendParams,
                },
              }),
        ),
      },
    ).then(async (response) => {
      cancel(() => {
        //注册回调
        controller.abort(); //取消请求
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        write(chunk);
      }

      complete("");
    });
  } catch (ex) {
    error(ex as any);
  }
};

export { requestAsStream };
