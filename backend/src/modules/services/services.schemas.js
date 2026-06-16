import { z } from 'zod';

export const SERVICE_TYPES = ['HTTP', 'API', 'WEB', 'EC2', 'CUSTOM'];
export const HTTP_SERVICE_TYPES = ['HTTP', 'API', 'WEB'];
export const CHECK_METHODS = ['GET', 'HEAD'];
export const CHECK_STATUSES = ['UP', 'DOWN', 'DEGRADED', 'UNKNOWN'];

const tagsSchema = z.record(z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])).optional();

function requiresUrl(type) {
  return HTTP_SERVICE_TYPES.includes(type);
}

const serviceBodySchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(SERVICE_TYPES),
  environment: z.string().min(1).max(80).default('production'),
  url: z.string().url().optional().nullable(),
  healthPath: z.string().max(255).optional().nullable(),
  method: z.enum(CHECK_METHODS).default('GET'),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(1000).max(30000).default(5000),
  intervalSeconds: z.number().int().min(30).max(3600).default(60),
  isActive: z.boolean().default(true),
  tags: tagsSchema,
}).strict();

export const createServiceSchema = serviceBodySchema.superRefine((value, ctx) => {
  if (requiresUrl(value.type) && !value.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'url is required for HTTP/API/WEB services',
    });
  }
});

export const updateServiceSchema = serviceBodySchema.partial().strict();

export function validateServiceDefinition(service) {
  return createServiceSchema.parse({
    name: service.name,
    description: service.description,
    type: service.type,
    environment: service.environment,
    url: service.url,
    healthPath: service.healthPath,
    method: service.method,
    expectedStatusCode: service.expectedStatusCode,
    timeoutMs: service.timeoutMs,
    intervalSeconds: service.intervalSeconds,
    isActive: service.isActive,
    tags: service.tags ?? undefined,
  });
}
