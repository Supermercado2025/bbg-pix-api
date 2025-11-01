import 'dotenv/config';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.send('Servidor rodando 🚀'));

app.post('/gerar-pix', async (req, res) => {
  const { valor = 39, cliente = 'Anônimo' } = req.body;
  let browser;

  try {
    console.log('→ Iniciando geração do PIX...');
    browser = await puppeteer.launch({
      headless: false, // veja o que acontece
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Acessa login
    console.log('→ Acessando página de login...');
    await page.goto('https://bbg.bet/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('body', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    // Login
    console.log('→ Preenchendo login...');
    const ph = await page.waitForSelector('input[placeholder="Número de Celular"]', { timeout: 30000 });
    await ph.click({ clickCount: 3 });
    await ph.type(process.env.BBG_USER);

    const pw = await page.waitForSelector('input[placeholder="Senha"]', { timeout: 20000 });
    await pw.click({ clickCount: 3 });
    await pw.type(process.env.BBG_PASS);

    // Clica em "Entrar"
    await page.evaluate(() => {
      const botao = [...document.querySelectorAll('button')].find(b =>
        /entrar|login/i.test(b.textContent)
      );
      if (botao) botao.click();
    });

    console.log('→ Fazendo login...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Login realizado!');

    // Vai para depósito
    console.log('→ Indo para a tela de depósito...');
    await page.goto('https://bbg.bet/deposit', { waitUntil: 'networkidle2' });
    await page.waitForSelector('body', { timeout: 20000 });

    // Define o valor
    console.log(`→ Definindo valor: R$ ${valor}`);
    const amt = await page.waitForSelector('div.amount input[placeholder*="Min. 10"]', { timeout: 20000 });
    await amt.click({ clickCount: 3 });
    await amt.type(String(valor));

    // Espera e clica no botão correto "Depositar Agora"
    console.log('→ Clicando em "Depositar Agora"...');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('div.button.topUp.active')]
        .some(b => b.textContent.trim().includes('Depositar Agora')),
      { timeout: 20000 }
    );

    await page.evaluate(() => {
      const botoes = [...document.querySelectorAll('div.button.topUp.active')];
      const botaoDepositar = botoes.find(b => b.textContent.trim().includes('Depositar Agora'));
      if (botaoDepositar) {
        botaoDepositar.scrollIntoView();
        botaoDepositar.click();
      } else {
        throw new Error('Botão "Depositar Agora" não encontrado!');
      }
    });

    // Aguarda o QR Code
    console.log('→ Aguardando QR Code...');
    await page.waitForSelector('#qrcode', { timeout: 60000 });

    // Extrai dados do QR Code
    const payload = await page.$eval('#qrcode', e => e.getAttribute('title'));
    const pix = {
      payload,
      valor,
      cliente,
      chave: payload.match(/5917(.{2})([^*]+)/)?.[2] || null,
      referencia: payload.match(/6304(.{4})/)?.[1] || null
    };

    console.log('✅ PIX gerado com sucesso!');
    console.log(pix);

    // Salva no Supabase
    const { error } = await supabase.from('pagamentos').insert([
      { cliente, valor, qrcode: payload, referencia: pix.referencia }
    ]);
    if (error) console.error('Erro ao salvar no Supabase:', error);

    res.json({ status: 'ok', ...pix });

  } catch (err) {
    console.error('❌ Erro ao gerar PIX:', err);
    try {
      const pages = await browser?.pages();
      if (pages?.length) {
        await pages[0].screenshot({ path: 'erro.png' });
        console.log('💾 Screenshot salvo: erro.png');
      }
    } catch {}
    res.status(500).json({ erro: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
