import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import axios from 'axios';
import { createPublicLookup, DestinationBlocked, parseMonitorUrl } from './destinationPolicy.js';

const timeout = 10_000;
const maxResponseBytes = 1024 * 1024;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const httpAgent = new HttpAgent({ keepAlive: false });
const httpsAgent = new HttpsAgent({ keepAlive: false });

export function createPingService({
  client = axios,
  lookup = createPublicLookup(),
  deadline,
} = {}) {
  return {
    async execute(input) {
      const startTime = Date.now();
      let statusCode = null;
      let errorLog = null;

      const signal = deadline ? deadline() : AbortSignal.timeout(timeout);
      try {
        const url = parseMonitorUrl(input);
        const response = await client.get(url.href, {
          adapter: 'http',
          proxy: false,
          httpAgent,
          httpsAgent,
          lookup,
          maxRedirects: 0,
          maxContentLength: maxResponseBytes,
          timeout,
          signal,
        });
        statusCode = response.status;
      } catch (error) {
        if (
          error instanceof DestinationBlocked ||
          error.code === 'MONITOR_DESTINATION_BLOCKED' ||
          error.cause?.code === 'MONITOR_DESTINATION_BLOCKED' ||
          (redirectStatuses.has(error.response?.status) && error.response?.headers?.location)
        ) {
          throw new DestinationBlocked();
        }

        if (error.response) {
          statusCode = error.response.status;
          errorLog = `HTTP Error ${statusCode}`;
        } else if (signal.aborted || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          errorLog = 'Timeout (10000ms)';
        } else if (
          error.code === 'ERR_BAD_RESPONSE' &&
          error.message.includes('maxContentLength')
        ) {
          errorLog = 'Resposta excedeu o limite de 1 MiB.';
        } else {
          errorLog = 'No response from server';
        }
      }

      return {
        success: errorLog === null,
        statusCode,
        responseTimeMs: Date.now() - startTime,
        errorLog,
      };
    },
  };
}

export default createPingService();
