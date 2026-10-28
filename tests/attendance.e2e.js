// Optional Selenium smoke test. Start the application first, then run npm run test:e2e.
// Requires Chrome and a compatible ChromeDriver available to Selenium.
const { Builder, By, until } = require("selenium-webdriver");
(async function run() {
  const driver = await new Builder().forBrowser("chrome").build();
  try {
    await driver.get(process.env.APP_URL || "http://localhost:3000");
    await driver.wait(until.titleContains("Student Attendance"), 10000);
    await driver.findElement(By.id("studentForm"));
    await driver.findElement(By.id("attendanceBody"));
    console.log("PASS: attendance dashboard loads.");
  } finally {
    await driver.quit();
  }
})().catch(err => { console.error(err); process.exit(1); });
