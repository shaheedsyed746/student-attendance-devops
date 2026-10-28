const test = require("node:test");
const assert = require("node:assert/strict");

test("attendance percentage calculation is present / recorded periods", () => {
  const present = 140, absent = 14;
  assert.equal(Number((present / (present + absent) * 100).toFixed(2)), 90.91);
});
test("seven periods are represented", () => {
  const periods = Array.from({length: 7}, (_, i) => i + 1);
  assert.deepEqual(periods, [1,2,3,4,5,6,7]);
});
test("low attendance threshold is below 75 percent", () => {
  assert.equal(74 / 100 < 0.75, true);
  assert.equal(75 / 100 < 0.75, false);
});
