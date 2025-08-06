import fs from "fs";

function generateCodes(count) {
  const codes = new Set();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  while (codes.size < count) {
    let part1 = "";
    let part2 = "";
    for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
    codes.add(`ODD-${part1}-${part2}`);
  }

  return Array.from(codes);
}

// Generate 2000 codes
const codes = generateCodes(2000);

// Save to a text file
fs.writeFileSync("whitelist_codes.txt", codes.join("\n"), "utf8");

console.log(`✅ Generated ${codes.length} codes and saved to whitelist_codes.txt`);
