import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./world-gen";
import { SEED } from "../src/config";

const out = join(__dirname, "..", "src", "data");
mkdirSync(out, { recursive: true });
const { world, inventory } = generate(SEED);
writeFileSync(join(out, "world.json"), JSON.stringify(world));
writeFileSync(join(out, "inventory.json"), JSON.stringify(inventory));
const over90 = inventory.filter((u) => u.age > 90).length;
console.log(`Generated ${inventory.length} units, ${((100 * over90) / inventory.length).toFixed(1)}% over 90 days, seed ${SEED}`);
