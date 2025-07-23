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

// ... (mantenha as funções extractValue, getRecaptchaToken e getCSRFToken iguais)

const server = http.createServer(async (req, res) => {
    const { bin } = url.parse(req.url, true).query;
    
    if (!bin || !/^\d{6}$/.test(bin)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Forneça um BIN válido de 6 dígitos" }));
    }

    try {
        const recaptchaToken = await getRecaptchaToken();
        const csrfToken = await getCSRFToken();

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

        // Resposta formatada para seu bot:
        const responseData = {
            success: true,
            bin: bin,
            pais: response.data.country || 'INDEFINIDO',
            bandeira: response.data.card || 'INDEFINIDO',
            type: response.data.type || 'INDEFINIDO',
            level: response.data.level || 'INDEFINIDO',
            banco: response.data.bank || 'INDEFINIDO'
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));

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
