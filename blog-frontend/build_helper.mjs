import { build } from 'vite';

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

build().then((output) => {
  console.log('BUILD SUCCESS');
  process.exit(0);
}).catch((err) => {
  console.error('BUILD FAILED');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Error code:', err.code);
  console.error('Error plugin:', err.plugin);
  console.error('Error id:', err.id);
  console.error('Stack:', err.stack);
  process.exit(1);
});
