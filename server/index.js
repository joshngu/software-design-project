import { createApp } from "./app.js";
import { initDb } from "./data/db.js";

const PORT = process.env.PORT || 4000;

initDb();

createApp().listen(PORT, () => {
  console.log(`QueueSmart backend listening on http://localhost:${PORT}`);
});
