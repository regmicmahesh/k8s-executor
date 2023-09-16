import { KubernetesClient } from "../kubernetes";
import WebSocket from "ws";

export abstract class BaseCompilerClient {
    protected kubernetesWs?: WebSocket;
    protected connId?: string;
    protected clientWs?: WebSocket;

    protected stdinBuffer = Buffer.alloc(1);

    abstract getLabelSelector(): string;
    abstract getCmd(): string;

    constructor(protected kubernetesClient: KubernetesClient) { }

    async onKubernetesWsOpen() {
        this.clientWs!.send(JSON.stringify({ status: "connected" }));
    }

    async run(ws: WebSocket) {
        this.clientWs = ws;

        await this.openKubernetesWsHandler();
        await this.bindEventListeners();
    }

    async openKubernetesWsHandler() {
        const { conn, connId } = await this.getWsConnection();
        this.kubernetesWs = conn;
        this.connId = connId;
        console.log(`[server] connected to pod ${connId}`);
    }

    async onKubernetesWsClose() {
        this.clientWs!.send(JSON.stringify({ status: "disconnected" }));
    }

    async OnKubernetesWsMessage(data: Buffer) {
        console.log(data);
        const [startingByte, ...msgBuffer] = data;
        const msg = msgBuffer.map((v) => String.fromCharCode(v)).join("");
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

        this.clientWs!.send(wsOutput);
    }

    async onClientWsMessage(data: Buffer) {
        const msg = data.toString("utf8").trim();
        const json = JSON.parse(msg);

        const cmd = json.stdin as string;
        console.log(data);
        this.kubernetesWs!.send(
            Buffer.concat([this.stdinBuffer, Buffer.from(`${cmd}\n`)])
        );
    }

    async onClientWsClose() {
        this.kubernetesWs!.close();
        await this.kubernetesClient.deletePod("default", this.connId!);
    }

    async bindEventListeners() {
        this.kubernetesWs!.on("open", this.onKubernetesWsOpen.bind(this));
        this.kubernetesWs!.on("message", this.OnKubernetesWsMessage.bind(this));
        this.kubernetesWs!.on("close", this.onKubernetesWsClose.bind(this));

        // client ws events
        this.clientWs!.on("message", this.onClientWsMessage.bind(this));
        this.clientWs!.on("close", this.onClientWsClose.bind(this));
    }

    private async extractPod() {
        const labelSelector = encodeURIComponent(this.getLabelSelector());

        const pods = await this.kubernetesClient.getPodsWithLabel(
            "default",
            labelSelector
        );

        const firstPod = pods[0];

        await this.kubernetesClient.removeLabelFromPod(
            "default",
            firstPod.metadata.name,
            "app"
        );

        return firstPod.metadata?.name!;
    }

    async getWsConnection() {
        const podName = await this.extractPod();

        const res = await this.kubernetesClient.getWsConnection(
            "default",
            podName,
            this.getCmd()
        );

        return { conn: res.conn, connId: podName };
    }
}
