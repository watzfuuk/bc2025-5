const http = require('http');
const fs = require('fs/promises');
const { program } = require('commander');


program
  .requiredOption('-h, --host <type>', 'Адреса сервера')
  .requiredOption('-p, --port <type>', 'Порт сервера')
  .requiredOption('-c, --cache <type>', 'Шлях до директорії для кешування');

program.parse(process.argv);

const { host, port, cache } = program.opts();


const createCacheDir = async () => {
  try {
    await fs.mkdir(cache, { recursive: true });
    console.log('Директорію для кешу створено.');
  } catch (error) {
    console.error('Помилка при створенні директорії для кешу:', error);
    process.exit(1);
  }
};




const path = require('path');

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  const statusCode = url.slice(1); 
  const filePath = path.join(cache, `${statusCode}.jpeg`);

  
  if (!/^\d+$/.test(statusCode)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Некоректний запит. URL має містити числовий код HTTP.');
  }

  switch (method) {
    case 'GET':
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);
      } catch (error) {
 
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Зображення не знайдено в кеші.');
      }
      break;

    case 'PUT':
      try {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          const data = Buffer.concat(chunks);
          await fs.writeFile(filePath, data);
          res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Зображення збережено в кеші.');
        });
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Внутрішня помилка сервера при записі файлу.');
      }
      break;

    case 'DELETE':
      try {
        await fs.unlink(filePath);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Зображення видалено з кешу.');
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Зображення не знайдено в кеші для видалення.');
      }
      break;

    default:
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Метод ${method} не підтримується.`);
      break;
  }
});

server.listen(port, host, async () => {
  await createCacheDir();
  console.log(`Проксі-сервер запущено на http://${host}:${port}`);
  console.log(`Кешування увімкнено. Директорія для кешу: ${cache}`);
});