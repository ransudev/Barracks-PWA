import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

type ScryptParameters = {
  N: number;
  r: number;
  p: number;
};

const DEFAULT_PARAMETERS: ScryptParameters = {
  N: COST,
  r: BLOCK_SIZE,
  p: PARALLELIZATION,
};

function deriveKey(
  password: string,
  salt: Buffer,
  parameters: ScryptParameters = DEFAULT_PARAMETERS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      parameters,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt);

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, cost, blockSize, parallelization, saltHex, expectedHex] = parts;

  if (
    !/^\d+$/.test(cost) ||
    !/^\d+$/.test(blockSize) ||
    !/^\d+$/.test(parallelization) ||
    !/^[a-f0-9]+$/.test(saltHex) ||
    !/^[a-f0-9]+$/.test(expectedHex) ||
    saltHex.length % 2 !== 0 ||
    expectedHex.length % 2 !== 0
  ) {
    return false;
  }

  const parameters: ScryptParameters = {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
  };

  if (
    !Number.isSafeInteger(parameters.N) ||
    !Number.isSafeInteger(parameters.r) ||
    !Number.isSafeInteger(parameters.p) ||
    parameters.N < 2 ||
    parameters.r < 1 ||
    parameters.p < 1
  ) {
    return false;
  }

  try {
    const derivedKey = await deriveKey(
      password,
      Buffer.from(saltHex, "hex"),
      parameters,
    );
    const expectedKey = Buffer.from(expectedHex, "hex");

    return (
      derivedKey.length === expectedKey.length &&
      timingSafeEqual(derivedKey, expectedKey)
    );
  } catch {
    return false;
  }
}
