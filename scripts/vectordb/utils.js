const fs = require('fs');
const fetch = require('node-fetch');

const config = require('./config');

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

// Function to extract the searchable information from a panel
function extractPanelData(panel) {
  //   return `
  //     Data sources: ${getDataSources([panel]).join(', ')},
  //     Panel title: ${panel.title},
  //     Panel description: ${panel.description},
  //     Panel type: ${panel.type},
  //     Panel datasource: ${panel.datasource},
  //     Panel queries: ${panel?.targets?.map((target) => target.expr).join(', ')},
  //     `.replace(/\n/g, '');
  return `Panel title: ${panel.title}, Panel description: ${panel.description}, Panel type: ${panel.type},`;
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
  return await fetch(`${config.vectorApi.url}/collections/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => res.json());
}

async function deleteCollection(collectionName) {
  console.log('Deleting collection:', collectionName);
  return await fetch(`${config.vectorApi.url}/collections/${collectionName}/delete`, {
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

  console.log('Creating collection:', collectionName);
  return await fetch(`${config.vectorApi.url}/collections/create`, {
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

  console.log('Inserting dashboard:', dashboard.title);
  return await fetch(`${config.vectorApi.url}/collections/${config.collections.dashboards}/upsert`, {
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

async function insertPanel(panel) {
  const body = JSON.stringify({
    id: panel.id,
    input: extractPanelData(panel),
    metadata: {},
  });

  console.log('Inserting panel:', body);

  return await fetch(`${config.vectorApi.url}/collections/${config.collections.panels}/upsert`, {
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

module.exports = {
  readAndParseJSON,
  TaskQueue,
  extractDashboardData,
  extractPanelData,
  getDataSources,
  getCollections,
  deleteCollection,
  createCollection,
  insertDashboard,
  insertPanel,
};
