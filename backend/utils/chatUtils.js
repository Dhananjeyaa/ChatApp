// Deterministic room id for a 1:1 conversation — same result
// regardless of who initiates it, so both users join the same room.
export const getConversationId = (userIdA, userIdB) =>
  [userIdA.toString(), userIdB.toString()].sort().join('_');
