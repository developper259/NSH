const { NSHServer } = require('../dist/core/Socket');

const port = 8080;
const server = new NSHServer(port);

server.start();

process.on('SIGINT', () => {
    console.log('\nArrêt du serveur NSH de test...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
});