// gRPC-Web proxy configuration for development
// This file should be used with envoy proxy or grpcwebproxy

const { spawn } = require('child_process');
const path = require('path');

// Start grpcwebproxy for development
function startGRPCWebProxy() {
  const proxyArgs = [
    '--backend_addr=localhost:9090',
    '--run_tls_server=false',
    '--allow_all_origins',
    '--server_http_debug_port=8080',
    '--server_bind_port=8081'
  ];

  const proxy = spawn('grpcwebproxy', proxyArgs, {
    stdio: 'inherit'
  });

  proxy.on('error', (err) => {
    console.error('Failed to start gRPC-Web proxy:', err);
    console.log('Make sure grpcwebproxy is installed:');
    console.log('go install github.com/improbable-eng/grpc-web/go/grpcwebproxy@latest');
  });

  proxy.on('close', (code) => {
    console.log(`gRPC-Web proxy exited with code ${code}`);
  });

  return proxy;
}

if (require.main === module) {
  console.log('Starting gRPC-Web proxy...');
  console.log('Backend: localhost:9090');
  console.log('Proxy: localhost:8081');
  startGRPCWebProxy();
}

module.exports = { startGRPCWebProxy };