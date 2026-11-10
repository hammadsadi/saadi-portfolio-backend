import { connectDB } from './config/index.js';
import app from './app.js';

const PORT = process.env.PORT ?? '5000';

connectDB()
  .then(() => {
    app.listen(Number(PORT), () => {
      console.info(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
