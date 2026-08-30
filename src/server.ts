import { resolve } from "node:path";
import { createSeamServer } from "./web-server.js";

const port = Number(process.env.SEAMSCRIPT_PORT ?? "4173");
const projectRoot = resolve(process.cwd());
const server = createSeamServer({ projectRoot });

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`SeamScript is ready at http://127.0.0.1:${port}\n`);
});
