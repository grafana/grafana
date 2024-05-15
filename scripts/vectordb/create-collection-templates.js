const fs = require('fs');
const path = require('path');

/** CONFIG **/
const TEMPLATE_COLLECTION_NAME = 'plugin_templates';

// Function to read and parse a JSON file
function readAndParseJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    return jsonData;
  } catch (err) {
    console.error('Error reading or parsing file:', err);
  }
}

class TaskQueue {
  constructor(concurrency) {
    this.concurrency = concurrency; // Maximum number of concurrent tasks
    this.running = 0; // Number of currently running tasks
    this.queue = []; // Queue to hold the tasks
  }

  // Add a task to the queue
  addTask(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            this.runNext(); // Trigger the next task in the queue
          });
      });
      this.runNext(); // Start running tasks if the queue is not full
    });
  }

  // Run the next task if the concurrency limit is not reached
  runNext() {
    if (this.running < this.concurrency && this.queue.length) {
      const nextTask = this.queue.shift();
      this.running++;
      nextTask();
    }
  }
}

// Function to create a collection template
function extractDashboardData(dashboard) {
  const panels = dashboard?.panels || dashboard?.rows?.flatMap((row) => row.panels) || [];
  return `
    Dashboard title: ${dashboard.title},
    Dashboard description: ${dashboard.description},
    Dashboard tags: ${dashboard.tags},
    Data sources: ${getDataSources(panels).join(', ')},
    Panels title: ${panels.map((panel) => panel.title).join(', ')},
    Panels description: ${panels.map((panel) => panel.description).join(', ')},
    Templating variables: ${dashboard.templating.list.map(({ label, name, type, query }) => `(Variable label: ${label}, Variable name: ${name}, Variable type: ${type}, Variable query: ${query})`).join(', ')},
    `;
}

function getDataSources(panels) {
  return panels
    .filter((panel) => !!panel.datasource)
    .map((panel) =>
      panel.datasource && typeof panel.datasource === 'object' ? panel?.datasource?.uid : String(panel.datasource)
    )
    .filter(Boolean);
}

async function getCollections() {
  return await fetch('http://localhost:8889/v1/collections/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json());
}

async function deleteCollection(collectionName) {
  return await fetch(`http://localhost:8889/v1/collections/${collectionName}/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json());
}

async function createCollection(collectionName) {
  // Create a collection to store dashboards if it doesn't exist
  const body = JSON.stringify({
    collection_name: collectionName,
    dimension: 384,
    exist_ok: true,
  });

  return await fetch('http://localhost:8889/v1/collections/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }).then((res) => res.json());
}

async function insertDashboard(dashboard) {
  const body = JSON.stringify({
    id: dashboard.uid,
    input: extractDashboardData(dashboard),
    metadata: dashboard,
  });

  return await fetch(`http://localhost:8889/v1/collections/${TEMPLATE_COLLECTION_NAME}/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })
    .then((res) => res.json())
    .then((res) => console.log('RESULT:', res))
    .catch((err) => console.error('ERROR:', err));
}

/** -------- main -------- **/
async function main() {
  // Replace 'your_file_path.json' with the path to your JSON file
  const jsonFilePath = path.join(__dirname, 'all_plugin_dashboards.json');
  const dashboards = readAndParseJSON(jsonFilePath);
  const taskQueue = new TaskQueue(10);

  const collections = await getCollections();
  console.log('Collections: ', collections);
  console.log('Deleting collection...');
  await deleteCollection(TEMPLATE_COLLECTION_NAME);
  const collectionsAfter = await getCollections();
  console.log('Collections: ', collectionsAfter);

  const pluginTemplatesCollection = await createCollection(TEMPLATE_COLLECTION_NAME);
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
