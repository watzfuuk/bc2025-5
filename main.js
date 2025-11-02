const http = require('http');
const fs = require('fs/promises');
const { program } = require('commander');
const superagent = require('superagent');


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
    console.log('Зображення взято з кешу.');
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Зображення для коду ${statusCode} немає в кеші. Завантаження з http.cat...`);
      try {
        const response = await superagent
          .get(`https://http.cat/${statusCode}`)
          .ok(() => true); 

        if (response.status === 200) {
          await fs.writeFile(filePath, response.body);
          console.log('Зображення завантажено і збережено в кеш.');
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(response.body);
        } else {
          console.log(`http.cat повернув статус ${response.status}`);
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Не вдалося знайти зображення на сервері http.cat.');
        }
      } catch (fetchError) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Помилка при завантаженні зображення з http.cat.');
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Внутрішня помилка сервера при читанні файлу.');
    }
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