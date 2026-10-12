export const REACTION_EMOJIS = [
  { key: "thumbs_up", emoji: "\u{1F44D}" },
  { key: "heart", emoji: "\u{2764}\u{FE0F}" },
  { key: "laugh", emoji: "\u{1F602}" },
  { key: "fire", emoji: "\u{1F525}" },
  { key: "celebrate", emoji: "\u{1F389}" }
];

export const getEmojiForKey = (key) => {
  const match = REACTION_EMOJIS.find(r => r.key === key);
  // Fallback to the key itself (in case it's an old raw emoji already stored in DB)
  return match ? match.emoji : key;
};
