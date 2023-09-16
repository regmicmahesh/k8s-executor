import WebSocket, { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { parse } from "node:url";
import { KubernetesClient } from "./kubernetes";
import { PythonCompilerClient } from "./compilers/pythonCompiler";

const API_URL = process.env.API_URL!;
const TOKEN = process.env.K8S_TOKEN!;

const PORT = parseInt(process.env.PORT!);

const kubernetesClient = new KubernetesClient({
    url: API_URL,
    token: TOKEN,
});

const pythonCompilerWss = new WebSocketServer({ noServer: true });

pythonCompilerWss.on("connection", async (ws: WebSocket) => {
    const compiler = new PythonCompilerClient(kubernetesClient);
    await compiler.run(ws);
});

const server = createServer();

server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url!, true);
    switch (pathname) {
        case "/python":
            pythonCompilerWss.handleUpgrade(request, socket, head, (ws) => {
                pythonCompilerWss.emit("connection", ws, request);
            });
            break;
        default:
            socket.destroy();
    }
});

server.listen(PORT, "0.0.0.0");
