import WebSocket from "ws";
import * as readline from "node:readline/promises";

const K8S_API_URL = process.env.K8S_API_URL!;
const TOKEN = process.env.K8S_TOKEN!;

const VALID_SUBPROTOCOLS = ["v4", "v3", "v2", "v1"].map(
    (v) => `${v}.channel.k8s.io`
);

const ws = new WebSocket(K8S_API_URL, VALID_SUBPROTOCOLS, {
    rejectUnauthorized: false, // TODO: this is insecure. We need to add CA cert later.
    headers: {
        Authorization: `Bearer ${TOKEN}`,
    },
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// this buffer is used to prepend stdin messages with a message type byte.
const stdinBuffer = Buffer.alloc(1);

ws.on("open", () => {
    console.log("Start sending commands...");
});

/*
 * The first byte of every message is a message type, which is a single byte.
 * The message types are:
 *   0: stdin (followed by 0 or more bytes of stdin data)
 *   1: stdout (followed by 0 or more bytes of stdout data)
 *   2: stderr (followed by 0 or more bytes of stderr data)
 */
ws.on("message", (data: Buffer) => {
    console.log("---");
    const newWay = data.subarray(1); // slicing of the message type byte.
    const msg = newWay.toString("utf8").trim();
    if (msg == "#" || msg.length == 0) { 
        console.log("---");
        return;
    }
    console.log(msg);
    console.log("---");
});

ws.on("close", () => {
    console.log("Connection closed");
});

ws.on("error", (err) => {
    console.error("Something went wrong");
});

rl.on("line", (input) => {
    ws.send(Buffer.concat([stdinBuffer, Buffer.from(`${input}\n`)]));
});
