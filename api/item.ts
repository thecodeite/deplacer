import { kv, } from '@vercel/kv';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function (request: VercelRequest, response: VercelResponse) {
  if (request.method === 'GET') {
    return GET(request, response);
  } else if (request.method === 'PUT') {
    return PUT(request, response);
  } else {
    return response.status(405).send('Method Not Allowed');
  }
}

export async function GET(request: VercelRequest, response: VercelResponse) {
  const id = request.query.id;
  const item = await kv.get(`deplacer-item:${id}`);
  return response.send(item);
}

export async function PUT(request: VercelRequest, response: VercelResponse) {
  console.log('request:', request)
  const {id} = request.query
  const body = await request.body;
  await kv.set(`deplacer-item:${id}`, body);
  return response.send('ok');
}