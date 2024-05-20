const path = require('path');

const config = require('./config');
const {
  TaskQueue,
  readAndParseJSON,
  getCollections,
  deleteCollection,
  createCollection,
  insertDashboard,
} = require('./utils');

/** -------- main -------- **/
async function main() {
  // Replace 'your_file_path.json' with the path to your JSON file
  const jsonFilePath = path.join(__dirname, 'all_plugin_dashboards.json');
  const dashboards = readAndParseJSON(jsonFilePath);
  const taskQueue = new TaskQueue(10);

  const collections = await getCollections();
  console.log('Collections: ', collections);
  console.log('Deleting collection...');
  await deleteCollection(config.collections.dashboards);
  const collectionsAfter = await getCollections();
  console.log('Collections: ', collectionsAfter);

  const pluginTemplatesCollection = await createCollection(config.collections.dashboards);
  console.log('Plugin templates collection: ', pluginTemplatesCollection);

  console.log('Inserting dashboards...');
  await Promise.all(
    Object.values(dashboards).map((dashboard) => {
      return taskQueue.addTask(insertDashboard.bind(this, dashboard));
    })
  );
  console.log('Done!');
}

main();
