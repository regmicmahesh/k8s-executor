import WebSocket, { WebSocketServer } from "ws";
import { KubernetesClient, PythonCompilerClient } from "./kubernetes";

const API_URL = process.env.API_URL!;
const TOKEN = process.env.K8S_TOKEN!;

const PORT = parseInt(process.env.PORT!);

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("listening", () => {
    console.log(`[server] listening on port ${PORT}`);
});

const stdinBuffer = Buffer.alloc(1);

const kubernetesClient = new KubernetesClient({
    url: API_URL,
    token: TOKEN,
});

const client = new PythonCompilerClient(kubernetesClient);
client.initialize();

wss.on("connection", async (ws: WebSocket) => {
    ws.send(JSON.stringify({ status: "connecting" }));

    const wsConn = await client.getWsConnection();

    const k8sws = wsConn.conn;
    const name = wsConn.connId;

    k8sws.on("open", () => {
        ws.send(JSON.stringify({ status: "connected" }));
    });

    ws.on("close", async () => {
        k8sws.close();
        await client.cleanup(name);
    });

    ws.on("message", (data: Buffer) => {
        const msg = data.toString("utf8").trim();
        const json = JSON.parse(msg);

        const cmd = json.stdin as string;
        k8sws.send(Buffer.concat([stdinBuffer, Buffer.from(`${cmd}\n`)]));
    });

    k8sws.on("close", () => {
        ws.send(JSON.stringify({ status: "disconnected" }));
    });

    k8sws.on("message", (data: Buffer) => {
        console.log("MSG", data.toString("utf8"));
        const newWay = data.subarray(1); // slicing of the message type byte.
        const msg = newWay.toString("utf8").trim();

        const startingByte = data[0];
        let wsOutput = "";

        switch (startingByte) {
            case 1:
                wsOutput = JSON.stringify({ stdout: msg });
                break;
            case 2:
                wsOutput = JSON.stringify({ stderr: msg });
                break;
            case 3:
                wsOutput = JSON.stringify({ stdin: msg });
                break;
            default:
                wsOutput = JSON.stringify({ status: "received unknown message" });
                break;
        }

        ws.send(wsOutput);
    });
});
