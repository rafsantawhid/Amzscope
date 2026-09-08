import crypto from "node:crypto";

export type DataMeta = {
  source: "live" | "cache" | "unavailable";
  fetchedAt: string;
  stale: boolean;
};

type JsonRecord = Record<string, unknown>;

const memoryCache = new Map<
  string,
  { value: unknown; expiresAt: number; fetchedAt: string }
>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export class ProviderSetupError extends Error {
  constructor() {
    super("RapidAPI is not configured. Add RAPIDAPI_KEY and RAPIDAPI_HOST.");
    this.name = "ProviderSetupError";
  }
}

export function getProviderStatus() {
  const keyConfigured = Boolean(process.env.RAPIDAPI_KEY);
  const hostConfigured = Boolean(process.env.RAPIDAPI_HOST);
  return {
    configured: keyConfigured && hostConfigured,
    hasKey: keyConfigured,
    hasHost: hostConfigured,
  };
}

export function getApiMeta(
  source: DataMeta["source"],
  fetchedAt = new Date().toISOString(),
  stale = false,
): DataMeta {
  return { source, fetchedAt, stale };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unwrapData(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  return payload.data ?? payload.results ?? payload.products ?? payload;
}

export function asList(payload: unknown): JsonRecord[] {
  const value = unwrapData(payload);
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) {
    const nested = value.items ?? value.products ?? value.results ?? value.data;
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function firstString(value: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return fallback;
}

function firstNumber(value: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string") {
      const parsed = Number(candidate.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function firstBoolean(value: JsonRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    if (typeof value[key] === "boolean") return value[key] as boolean;
  }
  return fallback;
}

function isoDate(value: unknown) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

export function normalizeProduct(
  value: JsonRecord,
  index = 0,
  meta = getApiMeta("live"),
) {
  const asin = firstString(value, ["asin", "ASIN", "productAsin"], `unknown-${index}`);
  const price = firstNumber(value, ["price", "current_price", "product_price"]);
  const listPrice = firstNumber(value, ["list_price", "original_price", "rrp"], price);
  return {
    asin,
    title: firstString(value, ["title", "product_title", "name"], "Amazon product"),
    brand: firstString(value, ["brand", "brand_name"], "Unknown brand"),
    imageUrl: firstString(value, ["image", "image_url", "product_photo", "thumbnail"]),
    price,
    listPrice: listPrice || null,
    discountPercent:
      listPrice > price && listPrice > 0
        ? Math.round(((listPrice - price) / listPrice) * 100)
        : null,
    rating: firstNumber(value, ["rating", "product_star_rating", "stars"]),
    reviewCount: Math.round(
      firstNumber(value, ["review_count", "product_num_ratings", "ratings_total"]),
    ),
    rank: Math.round(
      firstNumber(value, ["rank", "sales_rank", "best_sellers_rank"], index + 1),
    ),
    category: firstString(value, ["category", "category_name", "department"], "Amazon"),
    seller: firstString(value, ["seller", "seller_name", "merchant_name"]) || null,
    badge: firstString(value, ["badge", "product_badge"]) || null,
    trend: null,
    meta,
  };
}

export function normalizeReview(value: JsonRecord, asin: string, index = 0) {
  return {
    id: firstString(value, ["id", "review_id"], `${asin}-review-${index}`),
    asin,
    title: firstString(value, ["title", "review_title"], "Amazon customer review"),
    body: firstString(value, ["body", "review_comment", "text"], ""),
    rating: Math.round(firstNumber(value, ["rating", "stars"], 0)),
    author: firstString(value, ["author", "reviewer_name", "user_name"], "Amazon customer"),
    verified: firstBoolean(value, ["verified", "is_verified_purchase"]),
    helpfulVotes: Math.round(firstNumber(value, ["helpful_votes", "helpful_vote_count"])),
    createdAt: isoDate(value.created_at ?? value.review_date ?? value.date),
  };
}

export function normalizeOffer(value: JsonRecord, index = 0) {
  return {
    seller: firstString(value, ["seller", "seller_name", "merchant_name"], "Amazon seller"),
    price: firstNumber(value, ["price", "offer_price"]),
    condition: firstString(value, ["condition"], "New"),
    fulfillment: firstString(value, ["fulfillment", "shipping"], "Merchant fulfilled"),
    buyBox: firstBoolean(value, ["buy_box", "is_buy_box"], index === 0),
    shipping: firstNumber(value, ["shipping", "shipping_cost"]) || null,
  };
}

export async function rapidApiRequest(
  endpoint: string,
  params: Record<string, string | number | undefined>,
) {
  const { configured } = getProviderStatus();
  if (!configured) throw new ProviderSetupError();

  const key = `${endpoint}?${new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => [name, String(value)]),
  ).toString()}`;
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      payload: cached.value,
      meta: getApiMeta("cache", cached.fetchedAt),
    };
  }

  const host = process.env.RAPIDAPI_HOST!;
  const url = new URL(`https://${host}${endpoint}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const response = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
      "X-RapidAPI-Host": host,
    },
  });
  if (!response.ok) {
    throw new Error(`RapidAPI request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const fetchedAt = new Date().toISOString();
  memoryCache.set(key, {
    value: payload,
    expiresAt: Date.now() + CACHE_TTL_MS,
    fetchedAt,
  });
  return { payload, meta: getApiMeta("live", fetchedAt) };
}

export function cacheKey(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join(":")).digest("hex");
}