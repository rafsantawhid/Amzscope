import crypto from "node:crypto";
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  GetProductDetailsParams,
  GetProductDetailsQueryParams,
  GetProductOffersParams,
  GetProductOffersQueryParams,
  GetProductReviewsParams,
  GetProductReviewsQueryParams,
  GetTopProductReviewsParams,
  GetTopProductReviewsQueryParams,
  SaveProductBody,
  SendAssistantMessageBody,
  SearchProductsQueryParams,
  ScrapeProductByUrlBody,
} from "@workspace/api-zod";
import {
  db,
  assistantMessagesTable,
  savedProductsTable,
  searchHistoryTable,
} from "@workspace/db";
import {
  asList,
  getApiMeta,
  getProviderStatus,
  normalizeOffer,
  normalizeProduct,
  normalizeReview,
  rapidApiRequest,
  ProviderSetupError,
  unwrapData,
} from "../lib/amazon";
import { askGemini } from "../lib/gemini";
import { logger } from "../lib/logger";

const router = Router();
const ANONYMOUS_USER = "anonymous";

function userId(req: { headers: Record<string, unknown> }) {
  const header = req.headers["x-amazonscope-user"];
  return typeof header === "string" && header.trim() ? header : ANONYMOUS_USER;
}

function handleError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof ProviderSetupError) {
    res.status(503).json({ error: error.message });
    return;
  }
  logger.error({ err: error }, "AmazonScope request failed");
  res.status(502).json({ error: "The data provider could not complete this request." });
}

function pageFromQuery(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function productSearch(payload: unknown, meta: ReturnType<typeof getApiMeta>, page: number) {
  const source = asList(payload);
  return {
    items: source.map((item, index) => normalizeProduct(item, index, meta)),
    total: source.length,
    page,
    meta,
  };
}

function reviewResponse(payload: unknown, meta: ReturnType<typeof getApiMeta>, asin: string) {
  const source = asList(payload);
  return {
    reviews: source.map((item, index) => normalizeReview(item, asin, index)),
    total: source.length,
    histogram: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: source.filter((item) => Math.round(Number(item.rating ?? item.stars ?? 0)) === rating).length,
      percentage: source.length
        ? Math.round(
            (source.filter((item) => Math.round(Number(item.rating ?? item.stars ?? 0)) === rating).length /
              source.length) *
              100,
          )
        : 0,
    })),
    meta,
  };
}

function recordValue(payload: unknown, keys: string[]) {
  const value = unwrapData(payload);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return keys.map((key) => record[key]).find((candidate) => candidate !== undefined);
}

router.get("/dashboard", async (_req, res) => {
  const provider = getProviderStatus();
  if (!provider.configured) {
    res.json({
      trackedProducts: 0,
      searchesThisWeek: 0,
      averageRating: 0,
      marketPulse: 0,
      trending: [],
      bestSellers: [],
      deals: [],
      categories: [],
      meta: getApiMeta("unavailable"),
    });
    return;
  }

  try {
    const [trending, bestSellers, deals, categories] = await Promise.allSettled([
      rapidApiRequest("/search", { query: "trending products", page: 1, country: "US" }),
      rapidApiRequest("/best-sellers", { country: "US" }),
      rapidApiRequest("/deals", { page: 1, country: "US" }),
      rapidApiRequest("/product-category-list", { country: "US" }),
    ]);
    const successful = [trending, bestSellers, deals, categories].filter(
      (item): item is PromiseFulfilledResult<{ payload: unknown; meta: ReturnType<typeof getApiMeta> }> =>
        item.status === "fulfilled",
    );
    const meta = successful[0]?.value.meta ?? getApiMeta("unavailable");
    const dealPayload = deals.status === "fulfilled" ? asList(deals.value.payload) : [];
    const categoryPayload = categories.status === "fulfilled" ? asList(categories.value.payload) : [];
    res.json({
      trackedProducts: 0,
      searchesThisWeek: 0,
      averageRating: 0,
      marketPulse: 0,
      trending:
        trending.status === "fulfilled"
          ? productSearch(trending.value.payload, trending.value.meta, 1).items.slice(0, 6)
          : [],
      bestSellers:
        bestSellers.status === "fulfilled"
          ? productSearch(bestSellers.value.payload, bestSellers.value.meta, 1).items.slice(0, 6)
          : trending.status === "fulfilled"
            ? productSearch(trending.value.payload, trending.value.meta, 1).items.slice(0, 6)
            : [],
      deals: dealPayload.map((deal, index) => ({
        id: String(deal.id ?? deal.deal_id ?? `deal-${index}`),
        title: String(deal.title ?? deal.name ?? "Amazon deal"),
        discountPercent: Number(deal.discount_percent ?? deal.discount ?? 0),
        expiresAt: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
        imageUrl: String(deal.image ?? deal.image_url ?? ""),
        products: Number(deal.product_count ?? 0),
      })),
      categories: categoryPayload.map((category, index) => ({
        id: String(category.id ?? category.category_id ?? `category-${index}`),
        name: String(category.name ?? category.category_name ?? "Amazon category"),
        productCount: Number(category.product_count ?? 0),
        parentId: category.parent_id ? String(category.parent_id) : null,
      })),
      meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/search", async (req, res) => {
  try {
    const query = SearchProductsQueryParams.parse(req.query);
    const result = await rapidApiRequest("/search", {
      query: query.query,
      page: query.page,
      country: query.marketplace,
    });
    await db
      .insert(searchHistoryTable)
      .values({
        id: crypto.randomUUID(),
        userId: userId(req),
        query: query.query,
        kind: "product-search",
        resultCount: asList(result.payload).length,
      })
      .catch(() => undefined);
    res.json(productSearch(result.payload, result.meta, query.page ?? 1));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/category", async (req, res) => {
  try {
    const categoryId = String(req.query.categoryId ?? "");
    const page = pageFromQuery(req.query.page);
    const marketplace = String(req.query.marketplace ?? "US");
    if (!categoryId) {
      res.status(400).json({ error: "categoryId is required." });
      return;
    }
    const result = await rapidApiRequest("/products-by-category", {
      category_id: categoryId,
      page,
      country: marketplace,
    });
    res.json(productSearch(result.payload, result.meta, page));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/:asin", async (req, res) => {
  try {
    const params = GetProductDetailsParams.parse(req.params);
    const query = GetProductDetailsQueryParams.parse(req.query);
    const result = await rapidApiRequest("/product-details", {
      asin: params.asin,
      country: query.marketplace,
    });
    const base = normalizeProduct(
      (unwrapData(result.payload) as Record<string, unknown>) ?? {},
      0,
      result.meta,
    );
    const imagesValue = recordValue(result.payload, ["images", "image_urls", "product_images"]);
    const bulletsValue = recordValue(result.payload, ["bullets", "feature_bullets", "about"]);
    const detail = {
      ...base,
      images: Array.isArray(imagesValue) ? imagesValue.map(String) : [base.imageUrl].filter(Boolean),
      availability: String(recordValue(result.payload, ["availability", "availability_status"]) ?? "See Amazon"),
      bullets: Array.isArray(bulletsValue) ? bulletsValue.map(String) : [],
      description: String(recordValue(result.payload, ["description", "product_description"]) ?? ""),
      variations: [],
      attributes: {},
      specifications: {},
      buyBox: normalizeOffer({}, 0),
      reviewHistogram: [],
      meta: result.meta,
    };
    res.json(detail);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/:asin/offers", async (req, res) => {
  try {
    const params = GetProductOffersParams.parse(req.params);
    const query = GetProductOffersQueryParams.parse(req.query);
    const result = await rapidApiRequest("/product-offers", {
      asin: params.asin,
      country: query.marketplace,
    });
    res.json({
      offers: asList(result.payload).map(normalizeOffer),
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/:asin/reviews", async (req, res) => {
  try {
    const params = GetProductReviewsParams.parse(req.params);
    const query = GetProductReviewsQueryParams.parse(req.query);
    const result = await rapidApiRequest("/product-reviews", {
      asin: params.asin,
      page: query.page,
      country: query.marketplace,
    });
    res.json(reviewResponse(result.payload, result.meta, params.asin));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/:asin/reviews/:reviewId", async (req, res) => {
  try {
    const params = GetProductReviewsParams.parse(req.params);
    const result = await rapidApiRequest("/product-review-details", {
      asin: params.asin,
      review_id: req.params.reviewId,
      country: String(req.query.marketplace ?? "US"),
    });
    const review = normalizeReview((unwrapData(result.payload) as Record<string, unknown>) ?? {}, params.asin);
    res.json(review);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/products/:asin/top-reviews", async (req, res) => {
  try {
    const params = GetTopProductReviewsParams.parse(req.params);
    const query = GetTopProductReviewsQueryParams.parse(req.query);
    const result = await rapidApiRequest("/top-product-reviews", {
      asin: params.asin,
      country: query.marketplace,
    });
    res.json(reviewResponse(result.payload, result.meta, params.asin));
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/products/scrape", async (req, res) => {
  try {
    const body = ScrapeProductByUrlBody.parse(req.body);
    const result = await rapidApiRequest("/scrape-product-by-url", {
      url: body.url,
      country: body.marketplace,
    });
    const value = (unwrapData(result.payload) as Record<string, unknown>) ?? {};
    res.json({
      ...normalizeProduct(value, 0, result.meta),
      images: [String(value.image ?? value.image_url ?? "")].filter(Boolean),
      availability: "See Amazon",
      bullets: [],
      description: "",
      variations: [],
      attributes: {},
      specifications: {},
      buyBox: normalizeOffer({}, 0),
      reviewHistogram: [],
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

async function sellerRequest(req: { params: Record<string, string>; query: Record<string, unknown> }, endpoint: string) {
  return rapidApiRequest(endpoint, {
    seller_id: req.params.sellerId,
    page: pageFromQuery(req.query.page),
    country: String(req.query.marketplace ?? "US"),
  });
}

router.get("/sellers/:sellerId", async (req, res) => {
  try {
    const result = await sellerRequest(req, "/seller-details");
    const value = (unwrapData(result.payload) as Record<string, unknown>) ?? {};
    res.json({
      id: req.params.sellerId,
      name: String(value.name ?? value.seller_name ?? "Amazon seller"),
      rating: Number(value.rating ?? value.seller_rating ?? 0),
      reviewCount: Number(value.review_count ?? 0),
      productCount: Number(value.product_count ?? 0),
      marketplace: String(req.query.marketplace ?? "US"),
      location: value.location ? String(value.location) : null,
      storefrontUrl: value.storefront_url ? String(value.storefront_url) : null,
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/sellers/:sellerId/reviews", async (req, res) => {
  try {
    const result = await sellerRequest(req, "/seller-reviews");
    res.json(reviewResponse(result.payload, result.meta, ""));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/sellers/:sellerId/products", async (req, res) => {
  try {
    const result = await sellerRequest(req, "/seller-products");
    res.json(productSearch(result.payload, result.meta, pageFromQuery(req.query.page)));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/market/best-sellers", async (req, res) => {
  try {
    const result = await rapidApiRequest("/best-sellers", {
      category_id: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      country: String(req.query.marketplace ?? "US"),
    });
    res.json(productSearch(result.payload, result.meta, 1));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/market/deals", async (req, res) => {
  try {
    const result = await rapidApiRequest("/deals", {
      page: pageFromQuery(req.query.page),
      country: String(req.query.marketplace ?? "US"),
    });
    res.json({
      deals: asList(result.payload).map((deal, index) => ({
        id: String(deal.id ?? deal.deal_id ?? `deal-${index}`),
        title: String(deal.title ?? deal.name ?? "Amazon deal"),
        discountPercent: Number(deal.discount_percent ?? deal.discount ?? 0),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        imageUrl: String(deal.image ?? deal.image_url ?? ""),
        products: Number(deal.product_count ?? 0),
      })),
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/market/deals/:dealId/products", async (req, res) => {
  try {
    const result = await rapidApiRequest("/deal-products", {
      deal_id: req.params.dealId,
      country: String(req.query.marketplace ?? "US"),
    });
    res.json(productSearch(result.payload, result.meta, 1));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/market/promo-codes/:code", async (req, res) => {
  try {
    const result = await rapidApiRequest("/promo-code-details", {
      code: req.params.code,
      country: String(req.query.marketplace ?? "US"),
    });
    const value = (unwrapData(result.payload) as Record<string, unknown>) ?? {};
    res.json({
      code: req.params.code,
      status: String(value.status ?? "unknown"),
      discountPercent: Number(value.discount_percent ?? value.discount ?? 0),
      expiresAt: value.expires_at ? new Date(String(value.expires_at)).toISOString() : null,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/categories", async (req, res) => {
  try {
    const result = await rapidApiRequest("/product-category-list", {
      country: String(req.query.marketplace ?? "US"),
    });
    res.json(
      asList(result.payload).map((category, index) => ({
        id: String(category.id ?? category.category_id ?? `category-${index}`),
        name: String(category.name ?? category.category_name ?? "Amazon category"),
        productCount: Number(category.product_count ?? 0),
        parentId: category.parent_id ? String(category.parent_id) : null,
      })),
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/search-history", async (req, res) => {
  try {
    const rows = await db.query.searchHistoryTable.findMany({
      where: (table, { eq }) => eq(table.userId, userId(req)),
      orderBy: (table, { desc }) => desc(table.searchedAt),
      limit: 20,
    });
    res.json(
      rows.map((row) => ({
        id: row.id,
        query: row.query,
        kind: row.kind,
        searchedAt: row.searchedAt.toISOString(),
        resultCount: row.resultCount,
      })),
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/saved-products", async (req, res) => {
  try {
    const rows = await db.query.savedProductsTable.findMany({
      where: (table, { eq }) => eq(table.userId, userId(req)),
      orderBy: (table, { desc }) => desc(table.savedAt),
    });
    res.json(
      rows.map((row) => ({
        asin: row.asin,
        title: row.title,
        imageUrl: row.imageUrl,
        price: row.price,
        rating: row.rating,
        savedAt: row.savedAt.toISOString(),
      })),
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/saved-products", async (req, res) => {
  try {
    const body = SaveProductBody.parse(req.body);
    const saved = await db
      .insert(savedProductsTable)
      .values({
        id: crypto.randomUUID(),
        userId: userId(req),
        ...body,
      })
      .onConflictDoUpdate({
        target: [savedProductsTable.userId, savedProductsTable.asin],
        set: { title: body.title, imageUrl: body.imageUrl, price: body.price, rating: body.rating },
      })
      .returning();
    const row = saved[0];
    res.status(201).json({
      asin: row.asin,
      title: row.title,
      imageUrl: row.imageUrl,
      price: row.price,
      rating: row.rating,
      savedAt: row.savedAt.toISOString(),
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/saved-products/:asin", async (req, res) => {
  try {
    await db
      .delete(savedProductsTable)
      .where(
        and(
          eq(savedProductsTable.userId, userId(req)),
          eq(savedProductsTable.asin, req.params.asin),
        ),
      );
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/api-status", (_req, res) => {
  const provider = getProviderStatus();
  res.json({
    provider: provider.configured ? "connected" : "needs_setup",
    cache: "ready",
    endpointCount: 28,
    lastSync: null,
    message: provider.configured
      ? "RapidAPI is ready for live Amazon data."
      : "Add RAPIDAPI_HOST to complete the provider setup.",
  });
});

router.post("/assistant/chat", async (req, res) => {
  try {
    const body = SendAssistantMessageBody.parse(req.body);
    const currentUserId = userId(req);
    await db.insert(assistantMessagesTable).values({
      id: crypto.randomUUID(),
      userId: currentUserId,
      role: "user",
      content: body.message,
      asin: body.asin ?? null,
    });
    const content = await askGemini(body.message, body.context, body.asin);
    const createdAt = new Date().toISOString();
    await db.insert(assistantMessagesTable).values({
      id: crypto.randomUUID(),
      userId: currentUserId,
      role: "assistant",
      content,
      asin: body.asin ?? null,
    });
    res.json({
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/influencers/:influencerId", async (req, res) => {
  try {
    const result = await rapidApiRequest("/influencer-profile", {
      influencer_id: req.params.influencerId,
      country: String(req.query.marketplace ?? "US"),
    });
    const value = (unwrapData(result.payload) as Record<string, unknown>) ?? {};
    res.json({
      id: req.params.influencerId,
      name: String(value.name ?? "Amazon creator"),
      handle: String(value.handle ?? value.username ?? ""),
      followers: Number(value.followers ?? 0),
      platform: String(value.platform ?? "Amazon"),
      avatarUrl: value.avatar_url ? String(value.avatar_url) : null,
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/influencers/:influencerId/posts", async (req, res) => {
  try {
    const result = await rapidApiRequest("/influencer-posts", {
      influencer_id: req.params.influencerId,
      page: pageFromQuery(req.query.page),
      country: String(req.query.marketplace ?? "US"),
    });
    res.json({
      posts: asList(result.payload).map((post, index) => ({
        id: String(post.id ?? post.post_id ?? `post-${index}`),
        influencerId: req.params.influencerId,
        title: String(post.title ?? post.caption ?? "Amazon creator post"),
        publishedAt: new Date(String(post.published_at ?? Date.now())).toISOString(),
        engagementRate: post.engagement_rate ? Number(post.engagement_rate) : null,
        imageUrl: post.image_url ? String(post.image_url) : null,
      })),
      total: asList(result.payload).length,
      meta: result.meta,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/influencers/posts/:postId/products", async (req, res) => {
  try {
    const result = await rapidApiRequest("/influencer-post-products", {
      post_id: req.params.postId,
      country: String(req.query.marketplace ?? "US"),
    });
    res.json(productSearch(result.payload, result.meta, 1));
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/utils/asin/:asin/gtin", async (req, res) => {
  try {
    const result = await rapidApiRequest("/asin-to-gtin", { asin: req.params.asin });
    const output = String(recordValue(result.payload, ["gtin", "value", "output"]) ?? "");
    res.json({ input: req.params.asin, output, type: "GTIN" });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/utils/gtin/:gtin/asin", async (req, res) => {
  try {
    const result = await rapidApiRequest("/gtin-to-asin", { gtin: req.params.gtin });
    const output = String(recordValue(result.payload, ["asin", "value", "output"]) ?? "");
    res.json({ input: req.params.gtin, output, type: "ASIN" });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;