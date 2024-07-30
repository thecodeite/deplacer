import { kv, } from '@vercel/kv';

export async function GET() {
  let items: string[] = []
  let cursor = '0'
  let count = 0;
  do {
    const [newCursor, newItems] = await kv.scan('0', {match: 'deplacer-item:*'});
    cursor = newCursor;
    items = items.concat(newItems);
    if (count++ > 1000) throw new Error('too many items');
  }  while(cursor !== '0');

  items = items.map(str => str.substring('deplacer-item:'.length));

  return new Response(JSON.stringify(items), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

