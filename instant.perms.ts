import type { InstantRules } from "@instantdb/react";

// Browsers can only READ. All writes go through /api/* with the admin SDK.
const NO_WRITES = { create: "false", update: "false", delete: "false" };

const rules = {
  $default: { allow: { $default: "false" } },
  attrs: { allow: { $default: "false" } },
  $users: {
    allow: { view: "auth.id == data.id", ...NO_WRITES },
  },
  groups: {
    allow: { view: "auth.id in data.ref('members.user.id')", ...NO_WRITES },
  },
  exchanges: {
    allow: { view: "auth.id in data.ref('group.members.user.id')", ...NO_WRITES },
  },
  members: {
    allow: { view: "auth.id in data.ref('group.members.user.id')", ...NO_WRITES },
    fields: {
      // Only the organizer and the person themself see an email address.
      email: "auth.id in data.ref('user.id') || auth.id in data.ref('group.admins.id')",
    },
  },
  invites: {
    allow: { view: "false", ...NO_WRITES },
  },
  exclusions: {
    allow: { view: "auth.id in data.ref('exchange.group.members.user.id')", ...NO_WRITES },
  },
  assignments: {
    // Your own match only. The organizer sees all matches only after breaking the seal,
    // and breaking the seal is announced to everyone.
    allow: {
      view: "auth.id in data.ref('giver.user.id') || (auth.id in data.ref('exchange.group.admins.id') && true in data.ref('exchange.sealOpen'))",
      ...NO_WRITES,
    },
  },
  gifts: {
    allow: { view: "auth.id in data.ref('exchange.group.members.user.id')", ...NO_WRITES },
  },
  claims: {
    // Everyone in the group EXCEPT the person who wished for it.
    allow: {
      view: "auth.id in data.ref('exchange.group.members.user.id') && !(auth.id in data.ref('gift.owner.user.id'))",
      ...NO_WRITES,
    },
  },
  claimBuyers: {
    allow: { view: "auth.id in data.ref('buyer.user.id')", ...NO_WRITES },
  },
} satisfies InstantRules;

export default rules;
