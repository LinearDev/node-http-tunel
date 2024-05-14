const http = require("http");

const NGINX_SERVER_PORT = 8081;
const CLIENT_SERVER_PORT = 8082;

let tunelClient;
let respClinet = new Map();
let qu = [];

const checkQu = async () => {
    if (qu.length) {
        console.log("[ HTTP Server ] Queue clean up")
        if (!tunelClient) {
            return;
        }

        const to_send = qu.pop();
        tunelClient.end(to_send)
    }
}

/**
 * 
 * @param {http.ServerResponse & {req: http.IncomingMessage;}} res 
 * @param {boolean} update
 */
const handleTunel = (res) => {
    tunelClient = res;
    console.log("[ HTTP Server ] Client has been connected")

    checkQu()
}

/**
 * 
 * @param {http.IncomingMessage} req 
 * @param {string} body 
 */
const sendRawInput = async (req, body) => {
    const data = JSON.stringify({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body
    })

    if (!tunelClient) {
        qu.push(data)
        return
    }

    tunelClient.end(data)

    tunelClient = undefined;
}

const serverClient = http.createServer(async (req, res) => {
    if (req.url == "/hello/tunel/connection") {
        handleTunel(res)
        res.on("close", () => {
            tunelClient = undefined
        })
        return
    }

    let body = [];
    let bodyLength = 0

    await new Promise((resolve) => {
        req.on("data", (chunk) => {
            body.push(Buffer.from(chunk, "binary"));
            bodyLength += chunk.length;
            // console.log(req.headers, bodyLength)
            if (req.headers["content-length"] == bodyLength) {
                resolve()
            }
            return;
        });
        req.on("end", () => {
            req.removeAllListeners();
            // console.log("body end", body)
            resolve()
        })
    })

    const bodyCombined = Buffer.concat(body, bodyLength)
    // console.log(bodyCombined)

    const cl = respClinet.get(req.url)
    const status = req.headers.status
    delete req.headers.status
    cl.writeHead(status, req.headers);
    cl.end(bodyCombined);

    respClinet.delete(req.url);
    res.end("end")
    console.log("[ HTTP Server ] Send response to the client", req.url)
})

const server = http.createServer(async (req, res) => {
    let body = "";
    

    req.on('data', (chunk) => {
        if (chunk) {
            body += chunk;
            console.log("data chunk")
        }
    });

    await new Promise((resolve, reject) => {
        req.on("end", () => {
            console.log("[ HTTP Client ] Received new request", req.url);
            resolve()
        })
    })

    sendRawInput(req, body)
    respClinet.set(req.url, res)
    return
})

server.listen(NGINX_SERVER_PORT)
serverClient.listen(CLIENT_SERVER_PORT)