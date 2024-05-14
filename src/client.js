const {Axios} = require("axios");

const NGINX_SERVER_URI = "http://127.0.0.1:8082";
const API_URI = "http://127.0.0.1:3000"
const axios = new Axios({
    url: NGINX_SERVER_URI
});

const processor = async (req) => {
    console.log("[ HTTP Client ] Processing new http request", req.config.url)
    const serverData = JSON.parse(req.data)

    const data = {
        method: serverData.method,
        url: `${API_URI}${serverData.url}`,
        responseType: 'arraybuffer',
    }

    if (serverData.headers) {
        data.headers = serverData.headers
    }

    if (serverData.body) {
        data.data = serverData.body
    }

    const api_resp = await axios.request(data)
    console.log("[ HTTP Client ] Received data from local API")

    let resp_data;
    const content_type = api_resp.headers["content-type"] || api_resp.headers["Content-Type"] || ""

    if (content_type.includes("image")) {
        resp_data = Buffer.from(api_resp.data, "binary")
    } else if (content_type.includes("json") && typeof api_resp.data != "string") {
        resp_data = Buffer.from(api_resp.data, "utf8").toString()
    } else {
        resp_data = api_resp.data
    }

    if (api_resp.headers["transfer-encoding"]) {
        if (api_resp.headers["transfer-encoding"] == "chunked") {
            delete api_resp.headers["transfer-encoding"]
        }
    }

    const r = await axios.request({
        url: `${NGINX_SERVER_URI}${serverData.url}`,
        method: "POST",
        headers: {
            ...api_resp.headers,
            status: api_resp.status
        },
        data: resp_data
    });
    console.log(r.statusText)
    console.log("[ HTTP Client ] Http Server end")
    return;
}

const load = async () => {
    for (let i = 0; i < 2; i--) {
        const req = await axios.post(`${NGINX_SERVER_URI}/hello/tunel/connection`);
        processor(req)
        continue
    }
}
load()