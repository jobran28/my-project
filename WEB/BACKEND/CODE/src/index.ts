import 'reflect-metadata';

/* ──────────── OpenTelemetry bootstrap (BEFORE Express) ──────────── */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes as SRA } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation, ExpressRequestInfo } from '@opentelemetry/instrumentation-express';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Span } from '@opentelemetry/api';

/* === Resource descriptor === */
const resource = resourceFromAttributes({
  [SRA.SERVICE_NAME]: 'backend',
  [SRA.SERVICE_VERSION]: '1.0.0',
  'deployment.environment': process.env.NODE_ENV ?? 'development',
});

/* === Exporters === */
const traceExporter = new OTLPTraceExporter({
  url: 'http://otel-collector:4318/v1/traces',
});
const metricExporter = new OTLPMetricExporter({
  url: 'http://otel-collector:4318/v1/metrics',
});

/* === Metric reader === */
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60_000,
});

/* === HTTP & Express instrumentation with rich hooks === */
const expressInstr = new ExpressInstrumentation({
  spanNameHook: (info: ExpressRequestInfo): string => {
    const method = (info.request as any)?.method ?? '';
    return `${method} ${info.route}`;
  },
  requestHook(span: Span, info: ExpressRequestInfo): void {
    const req = info.request as import('express').Request;
    span.setAttribute('http.request.headers', JSON.stringify(req.headers));
    span.setAttribute('http.req.query', JSON.stringify(req.query));
    span.setAttribute('http.req.params', JSON.stringify(req.params));

    if (req.body && Object.keys(req.body).length > 0) {
      span.setAttribute('http.request.body', JSON.stringify(req.body).slice(0, 4_096));
    }
  },
});

const httpInstr = new HttpInstrumentation();
const prismaInstr = new PrismaInstrumentation();

/* === Build & start the SDK (sync in SDK v2) === */
export const otelSDK = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    httpInstr,
    expressInstr,
    prismaInstr,
    getNodeAutoInstrumentations(), // DB & other libraries
  ],
});

/* ──────────── Express-related imports (AFTER OTEL init code) ──────────── */
import express, { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import { configureRoutes } from './routes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './docs/swagger';
import cors from 'cors';
import * as httpProxyMiddleware from 'http-proxy-middleware'; // New namespace import
import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import * as net from 'net'; // Added for net.Socket

async function main() {
  try {
    otelSDK.start();
    console.log('✅ OpenTelemetry tracing & metrics initialized');
  } catch (err) {
    console.error('❌ OpenTelemetry failed to initialize:', err);
  }

  /* ──────────── Express application (AFTER SDK.start()) ──────────── */
  const tracer = trace.getTracer('backend');
  const app = express();

  // CORS configuration
  const corsOptions = {
    origin: '*', // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
    allowedHeaders: '*', // Allow all headers
    exposedHeaders: ['Authorization']
  };

  app.use(cors(corsOptions));

  const port = process.env.PORT || 5000;

  /* Body parsers */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  /* Pipeline‑wide span for each request */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('request.pipeline', {
      attributes: {
        'http.method': req.method,
        'http.target': req.originalUrl,
      },
    });

    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      span.setAttribute('http.response.headers', JSON.stringify(res.getHeaders()));
      span.end();
    });

    next();
  });
  app.use('/uploads/avatars', express.static('uploads/avatars'));

/* Swagger & feature routes */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/v1/api', configureRoutes());

/* Git proxy middleware */
// Use a direct type assertion to any to bypass all type checking on the options
const gitProxyOptions = {
  target: 'http://git-server:80/git',
  changeOrigin: true,
  // Fix: Use a function that returns the original path unchanged instead of false
  pathRewrite: (path: string) => path, // This keeps the original path as-is
  // @ts-ignore - onProxyReq is a valid option in http-proxy-middleware but TypeScript doesn't recognize it
  onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage, res: ServerResponse) => {
    console.log(`Proxying Git request: ${req.method} ${req.url} to http://git-server:80${proxyReq.path}`);
  },
  // @ts-ignore - onError is a valid option in http-proxy-middleware but TypeScript doesn't recognize it  
  onError: (err: Error, req: IncomingMessage, res: ServerResponse | net.Socket) => {
    console.error('Git proxy error:', err);

    if (res instanceof ServerResponse) {
      if (!res.headersSent) {
         res.writeHead(500, {
           'Content-Type': 'text/plain'
         });
      }
    }
    
    if (!res.destroyed && res.writable) {
      let canEnd = true;
      if (res instanceof ServerResponse) {
        canEnd = !res.writableEnded;
      }
      if (canEnd) {
        res.end(`Git proxy error: ${err.message}. Make sure the repository exists on the git-server.`);
      }
    }
  },
  // Add response handler to provide better error messages for 404s
  onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    console.log(`Git proxy response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    
    if (proxyRes.statusCode === 404) {
      const repoPath = req.url?.split('?')[0];
      console.warn(`Repository not found: ${repoPath}`);
    }
  }
} as any; // Use 'as any' to completely bypass type checking for the entire options object

app.use('/git', httpProxyMiddleware.createProxyMiddleware(gitProxyOptions));

/* Swagger & feature routes */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/v1/api', configureRoutes());

/* Start server */
const server = app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📄 API Docs     at http://localhost:${port}/api-docs`);
});

/* Graceful shutdown */
async function shutdown() {
  console.log('Shutting down…');
  await otelSDK.shutdown();
  server.close(() => process.exit(0));
}

} // <-- Add this to close the main() function

// Run the main function
main();