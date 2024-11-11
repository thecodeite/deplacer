import { kv, } from '@vercel/kv';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function (request: VercelRequest, response: VercelResponse) {
  if (request.method === 'GET') {
    return GET(request, response);
  } else {
    return response.status(405).send('Method Not Allowed');
  }
}

export async function GET(request: VercelRequest, response: VercelResponse) {
  let items: string[] = []
  let cursor = '0'
  let count = 0;
  do {
    const [newCursor, newItems] = await kv.scan(cursor, {match: 'deplacer-item:*'});
    cursor = newCursor;
    items = items.concat(newItems);
    if (count++ > 10) throw new Error('too many items');
  }  while(cursor !== '0');

  items = items.map(str => str.substring('deplacer-item:'.length));

  response.send(items);
}

