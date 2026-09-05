export type SignerMode = "wallet-external" | "server-key" | "kms";

export type SignerPolicyStatus = {
  mode: SignerMode;
  ready: boolean;
  production: boolean;
  usingServerKey: boolean;
  kmsConfigured: boolean;
  reason: string;
};

function parseSignerMode(rawValue: string | undefined): SignerMode {
  if (rawValue === "server-key" || rawValue === "kms" || rawValue === "wallet-external") {
    return rawValue;
  }
  return "wallet-external";
}

export function evaluateSignerPolicy(env: NodeJS.ProcessEnv = process.env): SignerPolicyStatus {
  const mode = parseSignerMode(env.EXECUTION_SIGNER_MODE?.trim());
  const production = env.NODE_ENV === "production";
  const usingServerKey = typeof env.EXECUTION_SIGNER_PRIVATE_KEY === "string" && env.EXECUTION_SIGNER_PRIVATE_KEY.trim().length > 0;
  const kmsConfigured = typeof env.EXECUTION_SIGNER_KMS_KEY_ID === "string" && env.EXECUTION_SIGNER_KMS_KEY_ID.trim().length > 0;

  if (mode === "server-key") {
    if (!usingServerKey) {
      return {
        mode,
        ready: false,
        production,
        usingServerKey,
        kmsConfigured,
        reason: "Signer mode is server-key but EXECUTION_SIGNER_PRIVATE_KEY is missing.",
      };
    }
    if (production) {
      return {
        mode,
        ready: false,
        production,
        usingServerKey,
        kmsConfigured,
        reason: "Signer mode server-key is blocked in production. Use KMS or external wallet signing.",
      };
    }
    return {
      mode,
      ready: true,
      production,
      usingServerKey,
      kmsConfigured,
      reason: "Server-key mode enabled for non-production environment.",
    };
  }

  if (mode === "kms") {
    return {
      mode,
      ready: kmsConfigured,
      production,
      usingServerKey,
      kmsConfigured,
      reason: kmsConfigured
        ? "KMS signer mode is configured."
        : "Signer mode is kms but EXECUTION_SIGNER_KMS_KEY_ID is missing.",
    };
  }

  return {
    mode,
    ready: true,
    production,
    usingServerKey,
    kmsConfigured,
    reason: "External wallet signer mode is active.",
  };
}
