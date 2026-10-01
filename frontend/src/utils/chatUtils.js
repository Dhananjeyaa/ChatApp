export const getConversationId = (userIdA, userIdB) =>
  [userIdA?.toString?.() ?? userIdA, userIdB?.toString?.() ?? userIdB].sort().join('_');
