import { seedDemoFixture } from "./demo-fixture";

try {
  await seedDemoFixture();
} catch (error) {
  console.error("demo fixture failed", error);
  process.exitCode = 1;
}
