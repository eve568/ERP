import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env, validateEnvironment } from './config/env.js';

validateEnvironment();
const app = createApp();

await connectDatabase(env.mongodbUri);

app.listen(env.port, () => {
  console.log(`ERP API escuchando en http://localhost:${env.port}`);
});
