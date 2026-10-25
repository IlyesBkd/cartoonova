// Defense in depth for cooperative test code, not a hostile-code sandbox.
import net from 'node:net';
import dgram from 'node:dgram';
import {syncBuiltinESMExports} from 'node:module';
import {chromium} from 'playwright';

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // Node's net.connect normalizes its arguments to a special [options, cb] array.
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const first = normalized[0];
  const options = typeof first === 'object' ? first : {host:typeof normalized[1]==='string'?normalized[1]:'localhost'};
  const host = options.host ?? 'localhost';
  if (!options.path && !['localhost','127.0.0.1','::1'].includes(host)) {
    throw new Error('TEST_NETWORK_BLOCKED: external socket');
  }
  return connect.apply(this,args);
};
dgram.Socket.prototype.send = function () {throw new Error('TEST_NETWORK_BLOCKED: UDP');};
syncBuiltinESMExports();

// Route mocks still work; any request they miss hits an intentionally closed
// loopback proxy instead of a supplier (including literal external IP URLs).
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({...options,
  proxy:{server:'http://127.0.0.1:9'},
  args:[...(options?.args??[]),'--proxy-bypass-list=<-loopback>'],
});
