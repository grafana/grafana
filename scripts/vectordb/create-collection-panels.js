const fs = require('fs');
const path = require('path');

const config = require('./config');
const {
  TaskQueue,
  readAndParseJSON,
  getCollections,
  deleteCollection,
  createCollection,
  insertPanel,
} = require('./utils');

/** -------- main -------- **/
async function main() {
  // Replace 'your_file_path.json' with the path to your JSON file
  const jsonFilePath = path.join(__dirname, 'all_plugin_dashboards.json');
  const dashboards = readAndParseJSON(jsonFilePath);
  const taskQueue = new TaskQueue(10);

  const collections = await getCollections();
  console.log('Collections: ', collections);
  await deleteCollection(config.collections.panels);
  const collectionsAfter = await getCollections();
  console.log('Collections: ', collectionsAfter);

  const panelsCollection = await createCollection(config.collections.panels);
  console.log('New collection created: ', panelsCollection);

  console.log('Inserting panels...');

  const tasks = [];
  Object.values(dashboards).forEach((dashboard) => {
    const panels = getPanels(dashboard);
    panels.forEach((panel) => {
      tasks.push(taskQueue.addTask(() => insertPanel(panel)));
    });
  });

  await Promise.all(tasks);
  console.log('Done!');
}

function getPanels(dashboard) {
  const panels = [];

  if (dashboard.rows) {
    dashboard.rows.forEach((row) => {
      if (row.panels) {
        row.panels.forEach((panel) => {
          panels.push(panel);
        });
      }
    });
  }
  if (dashboard.panels) {
    dashboard.panels.forEach((panel) => {
      panels.push(panel);
    });
  }

  return panels.filter((panel) => panel.type !== 'row');
}

main();
