import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
  return {
    ok: true,
    app: 'ClawNote backend',
  };
});

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '127.0.0.1' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
