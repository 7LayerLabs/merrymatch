import { i } from "@instantdb/react";

// Merry Match data model.
// Every write goes through the server (src/server/actions.ts) using the admin SDK.
// Browsers only READ, and instant.perms.ts decides what each person can see.
const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    // A family / friend group. Lives across many Christmases.
    groups: i.entity({
      name: i.string(),
      createdAt: i.number(),
    }),
    // One Christmas for one group.
    exchanges: i.entity({
      year: i.number().indexed(),
      title: i.string(),
      budgetCents: i.number().optional(), // per giver, total
      status: i.string(), // "open" | "drawn"
      drawnAt: i.number().optional(),
      noSwapPairs: i.boolean().optional(),
      avoidLastYear: i.boolean().optional(),
      sealOpen: i.boolean().optional(),
      sealOpenedAt: i.number().optional(),
      sealOpenedBy: i.string().optional(),
      createdAt: i.number(),
    }),
    // A person in a group (carries across years).
    members: i.entity({
      name: i.string(),
      role: i.string(), // "organizer" | "member"
      email: i.string().optional(), // set by organizer or on join; lowercase
      notes: i.string().optional(), // sizes, likes, "please avoid"
      avatar: i.string().optional(), // Christmas character key, see src/components/avatars.tsx
      joinedAt: i.number().optional(),
      createdAt: i.number(),
    }),
    // One-time invite links. Never readable from a browser.
    invites: i.entity({
      hash: i.string().unique().indexed(),
      createdAt: i.number(),
      usedAt: i.number().optional(),
    }),
    exclusions: i.entity({
      createdAt: i.number(),
    }),
    assignments: i.entity({
      slot: i.string().unique().indexed(), // `${exchangeId}:${giverId}`, blocks double draws
      createdAt: i.number(),
      revealedAt: i.number().optional(),
      changedAt: i.number().optional(), // set when a dropout/add rewired this match
    }),
    gifts: i.entity({
      title: i.string(),
      url: i.string().optional(),
      priceCents: i.number().optional(),
      store: i.string().optional(),
      size: i.string().optional(),
      color: i.string().optional(),
      imageUrl: i.string().optional(),
      note: i.string().optional(),
      createdAt: i.number().indexed(),
    }),
    // "Someone has this covered." Hidden from the person who wished for it.
    claims: i.entity({
      status: i.string(), // "reserved" | "purchased"
      updatedAt: i.number(),
    }),
    // Who covered it. Only the buyer can see this row.
    claimBuyers: i.entity({
      status: i.string(),
      giftTitle: i.string(),
      recipientName: i.string(),
      recipientId: i.string(),
      giftId: i.string(),
      priceCents: i.number().optional(),
      updatedAt: i.number().indexed(),
    }),
  },
  links: {
    memberUser: {
      forward: { on: "members", has: "one", label: "user" },
      reverse: { on: "$users", has: "many", label: "members" },
    },
    groupAdmins: {
      forward: { on: "groups", has: "many", label: "admins" },
      reverse: { on: "$users", has: "many", label: "adminGroups" },
    },
    groupMembers: {
      forward: { on: "members", has: "one", label: "group", onDelete: "cascade" },
      reverse: { on: "groups", has: "many", label: "members" },
    },
    groupExchanges: {
      forward: { on: "exchanges", has: "one", label: "group", onDelete: "cascade" },
      reverse: { on: "groups", has: "many", label: "exchanges" },
    },
    exchangeParticipants: {
      forward: { on: "exchanges", has: "many", label: "participants" },
      reverse: { on: "members", has: "many", label: "exchanges" },
    },
    inviteMember: {
      forward: { on: "invites", has: "one", label: "member", onDelete: "cascade" },
      reverse: { on: "members", has: "many", label: "invites" },
    },
    exclusionExchange: {
      forward: { on: "exclusions", has: "one", label: "exchange", onDelete: "cascade" },
      reverse: { on: "exchanges", has: "many", label: "exclusions" },
    },
    exclusionFrom: {
      forward: { on: "exclusions", has: "one", label: "from", onDelete: "cascade" },
      reverse: { on: "members", has: "many", label: "exclusionsFrom" },
    },
    exclusionTo: {
      forward: { on: "exclusions", has: "one", label: "to", onDelete: "cascade" },
      reverse: { on: "members", has: "many", label: "exclusionsTo" },
    },
    assignmentExchange: {
      forward: { on: "assignments", has: "one", label: "exchange", onDelete: "cascade" },
      reverse: { on: "exchanges", has: "many", label: "assignments" },
    },
    assignmentGiver: {
      forward: { on: "assignments", has: "one", label: "giver" },
      reverse: { on: "members", has: "many", label: "givingAssignments" },
    },
    assignmentRecipient: {
      forward: { on: "assignments", has: "one", label: "recipient" },
      reverse: { on: "members", has: "many", label: "receivingAssignments" },
    },
    giftExchange: {
      forward: { on: "gifts", has: "one", label: "exchange", onDelete: "cascade" },
      reverse: { on: "exchanges", has: "many", label: "gifts" },
    },
    giftOwner: {
      forward: { on: "gifts", has: "one", label: "owner", onDelete: "cascade" },
      reverse: { on: "members", has: "many", label: "gifts" },
    },
    claimGift: {
      forward: { on: "claims", has: "one", label: "gift", onDelete: "cascade" },
      reverse: { on: "gifts", has: "one", label: "claim" },
    },
    claimExchange: {
      forward: { on: "claims", has: "one", label: "exchange", onDelete: "cascade" },
      reverse: { on: "exchanges", has: "many", label: "claims" },
    },
    claimBuyerClaim: {
      forward: { on: "claimBuyers", has: "one", label: "claim" },
      reverse: { on: "claims", has: "one", label: "buyerRow" },
    },
    claimBuyerBuyer: {
      forward: { on: "claimBuyers", has: "one", label: "buyer", onDelete: "cascade" },
      reverse: { on: "members", has: "many", label: "purchases" },
    },
    claimBuyerExchange: {
      forward: { on: "claimBuyers", has: "one", label: "exchange", onDelete: "cascade" },
      reverse: { on: "exchanges", has: "many", label: "claimBuyers" },
    },
  },
  rooms: {},
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
