import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  ...timestamps,
});

export const productsTable = pgTable(
  "products",
  {
    asin: text("asin").primaryKey(),
    title: text("title").notNull(),
    brand: text("brand").notNull(),
    imageUrl: text("image_url").notNull(),
    price: real("price").notNull(),
    listPrice: real("list_price"),
    discountPercent: real("discount_percent"),
    rating: real("rating").notNull(),
    reviewCount: integer("review_count").notNull(),
    rank: integer("rank").notNull(),
    category: text("category").notNull(),
    sellerId: text("seller_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (table) => [index("products_category_idx").on(table.category)],
);

export const sellersTable = pgTable("sellers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rating: real("rating").notNull(),
  reviewCount: integer("review_count").notNull(),
  productCount: integer("product_count").notNull(),
  marketplace: text("marketplace").notNull(),
  location: text("location"),
  storefrontUrl: text("storefront_url"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

export const reviewsTable = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    asin: text("asin").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    rating: integer("rating").notNull(),
    author: text("author").notNull(),
    verified: boolean("verified").notNull().default(false),
    helpfulVotes: integer("helpful_votes").notNull().default(0),
    reviewCreatedAt: timestamp("review_created_at", {
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [index("reviews_asin_idx").on(table.asin)],
);

export const offersTable = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    asin: text("asin").notNull(),
    seller: text("seller").notNull(),
    price: real("price").notNull(),
    condition: text("condition").notNull(),
    fulfillment: text("fulfillment").notNull(),
    buyBox: boolean("buy_box").notNull().default(false),
    shipping: real("shipping"),
    ...timestamps,
  },
  (table) => [index("offers_asin_idx").on(table.asin)],
);

export const categoriesTable = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  productCount: integer("product_count").notNull().default(0),
  parentId: text("parent_id"),
  ...timestamps,
});

export const dealsTable = pgTable("deals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  discountPercent: real("discount_percent").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  imageUrl: text("image_url").notNull(),
  productCount: integer("product_count").notNull().default(0),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

export const influencersTable = pgTable("influencers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  followers: integer("followers").notNull(),
  platform: text("platform").notNull(),
  avatarUrl: text("avatar_url"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  ...timestamps,
});

export const searchHistoryTable = pgTable(
  "search_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    query: text("query").notNull(),
    kind: text("kind").notNull(),
    resultCount: integer("result_count"),
    searchedAt: timestamp("searched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("search_history_user_idx").on(table.userId)],
);

export const savedProductsTable = pgTable(
  "saved_products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    asin: text("asin").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url").notNull(),
    price: real("price"),
    rating: real("rating"),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_products_user_asin_idx").on(table.userId, table.asin),
  ],
);

export const apiCacheTable = pgTable(
  "api_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    endpoint: text("endpoint").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("api_cache_expiry_idx").on(table.expiresAt)],
);

export const assistantMessagesTable = pgTable(
  "assistant_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    asin: text("asin"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("assistant_messages_user_idx").on(table.userId)],
);

export const insertUserSchema = createInsertSchema(usersTable);
export const insertProductSchema = createInsertSchema(productsTable);
export const insertSellerSchema = createInsertSchema(sellersTable);
export const insertReviewSchema = createInsertSchema(reviewsTable);
export const insertOfferSchema = createInsertSchema(offersTable);
export const insertCategorySchema = createInsertSchema(categoriesTable);
export const insertDealSchema = createInsertSchema(dealsTable);
export const insertInfluencerSchema = createInsertSchema(influencersTable);
export const insertSearchHistorySchema = createInsertSchema(searchHistoryTable);
export const insertSavedProductSchema = createInsertSchema(savedProductsTable);
export const insertApiCacheSchema = createInsertSchema(apiCacheTable);
export const insertAssistantMessageSchema = createInsertSchema(
  assistantMessagesTable,
);

export type User = z.infer<typeof insertUserSchema>;
export type Product = typeof productsTable.$inferSelect;
export type Seller = typeof sellersTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type Offer = typeof offersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Deal = typeof dealsTable.$inferSelect;
export type Influencer = typeof influencersTable.$inferSelect;
export type SearchHistory = typeof searchHistoryTable.$inferSelect;
export type SavedProduct = typeof savedProductsTable.$inferSelect;
export type ApiCache = typeof apiCacheTable.$inferSelect;
export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;