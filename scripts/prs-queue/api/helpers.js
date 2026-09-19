// Answers in input order, so a caller can pair results with items without tracking completion.
async function mapWithLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

module.exports = { mapWithLimit };
