const http = require('http');

/**
 * Starts a HTTP server that provides a readiness endpoint indicating the build status.
 * The server responds with:
 * - 200 when the build is complete and successful
 * - 503 when the build is in progress, for both the initial build and subsequent rebuilds when in watch mode
 * - 500 when the build has failed
 *
 * This is used in the devenv/frontend-service Tiltfile to determine when the frontend build is ready.
 */
class HttpReadinessPlugin {
  /**
   * @param {Object} options
   * @param {number} options.port
   * @param {string} [options.host]
   */
  constructor(options = {}) {
    this.port = options.port;
    this.host = options.host || 'localhost';
    this.isReady = false;
    this.server = null;
    this.hasError = false;
  }

  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    // Start HTTP server on first compilation
    compiler.hooks.beforeCompile.tapAsync('HttpReadinessPlugin', (params, callback) => {
      if (!this.server) {
        this.startServer();
      }
      callback();
    });

    // Mark as building when compilation starts
    compiler.hooks.compile.tap('HttpReadinessPlugin', () => {
      this.isReady = false;
      this.hasError = false;
      console.log('[HttpReadinessPlugin] Build started - readiness endpoint returning 503');
    });

    // Mark as ready when compilation completes successfully
    compiler.hooks.done.tap('HttpReadinessPlugin', (stats) => {
      if (stats.hasErrors()) {
        this.hasError = true;
        this.isReady = false;
        console.log('[HttpReadinessPlugin] Build completed with errors - readiness endpoint returning 500');
      } else {
        this.isReady = true;
        this.hasError = false;
        console.log('[HttpReadinessPlugin] Build completed successfully - readiness endpoint returning 200');
      }
    });

    // Mark as error on compilation failure
    compiler.hooks.failed.tap('HttpReadinessPlugin', () => {
      this.hasError = true;
      this.isReady = false;
      console.log('[HttpReadinessPlugin] Build failed - readiness endpoint returning 500');
    });

    // Close server on shutdown
    compiler.hooks.shutdown.tap('HttpReadinessPlugin', () => {
      this.stopServer();
    });
  }

  startServer() {
    this.server = http.createServer((req, res) => {
      // Only respond to GET requests
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      // Respond based on build state
      if (this.isReady) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK - Build ready');
      } else if (this.hasError) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error - Build failed');
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Service Unavailable - Build in progress');
      }
    });

    this.server.listen(this.port, this.host, () => {
      console.log(`[HttpReadinessPlugin] Readiness server listening on http://${this.host}:${this.port}`);
    });

    this.server.on('error', (error) => {
      console.error(`[HttpReadinessPlugin] Server error:`, error);
    });
  }

  stopServer() {
    if (this.server) {
      this.server.close(() => {
        console.log('[HttpReadinessPlugin] Readiness server stopped');
      });
      this.server = null;
    }
  }
}

module.exports = HttpReadinessPlugin;
