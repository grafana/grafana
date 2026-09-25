declare module 'http-server' {
  interface HttpServerOptions {
    root?: string;
    cache?: number;
  }

  interface HttpServer {
    listen(port: number, hostname: string, callback: () => void): void;
    close(): void;
  }

  export function createServer(options?: HttpServerOptions): HttpServer;
}
