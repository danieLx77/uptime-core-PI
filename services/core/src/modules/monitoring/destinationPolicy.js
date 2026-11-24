import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

const [globalIPv6, globalIPv6Prefix] = ipaddr.parseCIDR('2000::/3');
const excludedIPv6 = ['2001::/23', '2002::/16', '3fff::/20'].map((range) =>
  ipaddr.parseCIDR(range)
);
const benchmarkingIPv4 = ipaddr.parseCIDR('198.18.0.0/15');

export class DestinationBlocked extends Error {
  constructor() {
    super('Destino do monitor bloqueado pela política de rede.');
    this.code = 'MONITOR_DESTINATION_BLOCKED';
  }
}

export function isPublicAddress(address) {
  if (!isIP(address) || address.includes('%')) return false;
  const ip = ipaddr.process(address);
  if (ip.range() !== 'unicast') return false;
  if (ip.kind() === 'ipv4') return !ip.match(benchmarkingIPv4);
  return ip.match(globalIPv6, globalIPv6Prefix) && !excludedIPv6.some((range) => ip.match(range));
}

function isTestTarget(url) {
  return (
    process.env.NODE_ENV === 'test' &&
    url.protocol === 'http:' &&
    url.hostname === '127.0.0.1' &&
    url.port !== '' &&
    url.origin === process.env.MONITORING_TEST_ORIGIN
  );
}

export function parseMonitorUrl(input) {
  if (typeof input !== 'string') throw new TypeError('URL inválida.');
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new DestinationBlocked();
  }
  if (isTestTarget(url)) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const domain = host.toLowerCase().replace(/\.$/, '');
  if (
    domain === 'localhost' ||
    domain.endsWith('.localhost') ||
    (isIP(host) && !isPublicAddress(host))
  ) {
    throw new DestinationBlocked();
  }
  return url;
}

// O lookup é usado pela própria conexão. O hostname original continua no HTTP e no TLS.
export function createPublicLookup(resolve = lookup) {
  return (hostname, options, callback) => {
    void Promise.resolve()
      .then(() => resolve(hostname, { all: true }))
      .then((addresses) => {
        if (
          !addresses.length ||
          addresses.some(
            ({ address, family }) => isIP(address) !== family || !isPublicAddress(address)
          )
        ) {
          callback(new DestinationBlocked());
          return;
        }

        const eligible = addresses.filter(
          ({ family }) => !options.family || family === options.family
        );
        if (!eligible.length) {
          callback(new Error('Nenhum endereço DNS da família solicitada.'));
        } else if (options.all) {
          callback(null, eligible);
        } else {
          callback(null, eligible[0].address, eligible[0].family);
        }
      }, callback);
  };
}
