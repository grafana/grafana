import * as puppeteer from 'puppeteer';
import 'process';

interface ScreenshotCommandlineArguments {
  url: string;
  path: string;
  headless: boolean;
  width: number;
  height: number;
  type: string;
  slowMo: number;
  domain: string;
  renderKey: string;
  timeout: number;
}

async function makeScreenshot(options: ScreenshotCommandlineArguments) {
  console.log(`Taking screenshot using the following settings`, options);

  const browser = await puppeteer.launch({ headless: options.headless });
  const page = await browser.newPage();

  let authCookie = {
    name: 'renderKey',
    value: options.renderKey,
    domain: options.domain,
  };
  await page.setCookie(authCookie);

  const viewport = { width: options.width, height: options.height };
  await page.setViewport(viewport);
  await page.goto(options.url);

  await page.waitForFunction(`(() => {
    if (!window.angular) { return false; }
    var body = window.angular.element(document.body);
    if (!body.injector) { return false; }
    if (!body.injector()) { return false; }

    var rootScope = body.injector().get('$rootScope');
    if (!rootScope) { return false; }
    var panels = angular.element('div.panel:visible').length;
    return rootScope.panelsRendered >= panels;
  })()`);

  await page.screenshot({ path: options.path });

  console.log('Screenshot taken.');

  // dunno why I need this but it hangs otherwise
  process.exit(0);
}

function parseCommandLineArguments(args): ScreenshotCommandlineArguments {
  let params: ScreenshotCommandlineArguments = {
    url: null,
    path: null,
    headless: true,
    width: 250,
    height: 100,
    type: 'png',
    slowMo: 0,
    renderKey: null,
    domain: null,
    timeout: 0,
  };

  const stringArgs = ['url', 'path', 'renderKey', 'domain'];

  const regex = /^([^=]+)=([^$]+)/;
  for (let rawArg of args) {
    const parts = rawArg.match(regex);
    if (!parts) {
      continue;
    }

    const arg = parts[1];
    const value = parts[2];
    if (stringArgs.indexOf(arg) !== -1) {
      // these args require no special validation
      params[arg] = value;
      continue;
    }

    switch (arg) {
      case 'png':
        params.path = value;
        break;
      case 'headless':
        params.headless = value === 'false';
        break;
      case 'width':
        params.width = parseInt(value);
        if (isNaN(params.width) || params.width <= 0) {
          throw new Error(`width=${value} is invalid`);
        }
        break;
      case 'height':
        params.height = parseInt(value);
        if (isNaN(params.height) || params.height <= 0) {
          throw new Error(`height=${value} is invalid`);
        }
        break;
      case 'type':
        params.type = value;
        if (params.type !== 'png' && params.type !== 'jpg') {
          throw new Error(`Invalid type=${value}, must be png or jpg`);
        }
      case 'slowMo':
        params.slowMo = parseInt(value);
        if (isNaN(params.slowMo) || params.slowMo < 0) {
          throw new Error(`slowMo=${value} is invalid`);
        }
    }
  }

  if (params.slowMo > 0 && params.headless) {
    console.log(`slowMo=${params.slowMo} specified, forcing headless=false`);
  }

  console.log(params);
  for (let arg of ['url', 'path', 'domain', 'renderKey']) {
    if (!params[arg]) {
      throw new Error(`Missing argument ${arg}`);
    }
  }

  return params;
}

let args: ScreenshotCommandlineArguments;
try {
  args = parseCommandLineArguments(process.argv.slice(2));
} catch (e) {
  console.error(`Could not parse command line arguments: ${e}`);
  process.exit(1);
}

(async () => {
  await makeScreenshot(args);
})();
