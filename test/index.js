const { NSHServer } = require('../dist/core/Socket');

const port = 1212;
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