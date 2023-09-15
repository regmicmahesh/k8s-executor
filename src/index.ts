import WebSocket, { WebSocketServer } from "ws";

const K8S_API_URL = process.env.K8S_API_URL!;
const TOKEN = process.env.K8S_TOKEN!;

const PORT = parseInt(process.env.PORT!);

const VALID_SUBPROTOCOLS = ["v4", "v3", "v2", "v1"].map(
  (v) => `${v}.channel.k8s.io`
);

const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`[server] listening on port ${PORT}`);
});

const stdinBuffer = Buffer.alloc(1);

console.log(TOKEN);

wss.on("connection", (ws: WebSocket) => {
  let k8sws = new WebSocket(K8S_API_URL, VALID_SUBPROTOCOLS, {
    rejectUnauthorized: false, // TODO: this is insecure. We need to add CA cert later.
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  k8sws.on("open", () => {
    ws.send(JSON.stringify({ status: "connected" }));
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
