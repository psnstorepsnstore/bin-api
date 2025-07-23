const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const http = require('http');
const url = require('url');

const cookieJar = new tough.CookieJar();
const axiosInstance = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
}));

function extractValue(text, start, end) {
    const startIndex = text.indexOf(start);
    if (startIndex === -1) return null;
    const endIndex = text.indexOf(end, startIndex + start.length);
    if (endIndex === -1) return null;
    return text.substring(startIndex + start.length, endIndex);
}

async function getRecaptchaToken() {
    try {
        await axiosInstance.get('https://binchecker.pro/');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response1 = await axiosInstance.get('https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LenoYUfAAAAABiVts42vmUI7eDm87pFCctEiWPc&co=aHR0cHM6Ly9iaW5jaGVja2VyLnBybzo0NDM.&hl=pt-BR&v=EGO3I7Q26cZ-jBw3BEtzIx7-&size=invisible&cb=2tc2aygyo0r0');
        const rtk = extractValue(response1.data, '<input type="hidden" id="recaptcha-token" value="', '"');
        if (!rtk) throw new Error('Token recaptcha não encontrado');

        await new Promise(resolve => setTimeout(resolve, 1000));

        const response2 = await axiosInstance.post('https://www.google.com/recaptcha/api2/reload?k=6LenoYUfAAAAABiVts42vmUI7eDm87pFCctEiWPc', `v=EGO3I7Q26cZ-jBw3BEtzIx7-&reason=q&c=${rtk}&k=6LenoYUfAAAAABiVts42vmUI7eDm87pFCctEiWPc&co=aHR0cHM6Ly9iaW5jaGVja2VyLnBybzo0NDM.&hl=pt-BR&size=invisible&chr=[89,64,27]&vh=13599012192&bg=!q62grYxHRvVxjUIjSFNd0mlvrZ-iCgIHAAAB6FcAAAANnAkBySdqTJGFRK7SirleWAwPVhv9-XwP8ugGSTJJgQ46-0RVSX3WSakV_UKP1K_fUxhR90xgy1KKiAw66XHwqkXxhH8PoDS4RkAqH0cV3HBWwE4Ox3Jc_l3AMKg6sGJ3Q5RTA5E7TYlc9DiQu4_213hMLWkC_MGhqhnggo8tGkiBu4-96UwNDD7lnojjpV8VZc7bTCsEYHDOzEEgr_iYP5IXL7KiLCJgJHQG7_h-_wTMmwR1EpVNTR8Z8UYC9VBZh_hPkf_eY6GlEXrAEJaXDZgXS9FSH_OvZeJAws9xxC3kgZ0HhEBMQDwFw7Yyf_8bRmXWs7olnZpQc3U3HVpEHb2Ie_KqPzQPNRdaUhLgfpAZpQcO4lDvw6qDCKJ0aWQ`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return extractValue(response2.data, 'rresp","', '"');
    } catch (error) {
        console.error('Erro no recaptcha:', error.message);
        return null;
    }
}

async function getCSRFToken() {
    try {
        const response = await axiosInstance.get('https://binchecker.pro/');
        return extractValue(response.data, 'name="csrf-token" content="', '"');
    } catch (error) {
        console.error('Erro no CSRF:', error.message);
        return null;
    }
}

const server = http.createServer(async (req, res) => {
    const { bin } = url.parse(req.url, true).query;
    
    if (!bin || !/^\d{6}$/.test(bin)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Forneça um BIN válido de 6 dígitos" }));
    }

    try {
        const recaptchaToken = await getRecaptchaToken();
        const csrfToken = await getCSRFToken();

        if (!recaptchaToken || !csrfToken) {
            throw new Error('Falha ao obter tokens necessários');
        }

        const response = await axiosInstance.post('https://binchecker.pro/bincheck', {
            bin: bin,
            "g-recaptcha-response": recaptchaToken
        }, {
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            bin: bin,
            data: response.data
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));