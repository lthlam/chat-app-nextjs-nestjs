import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function init() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Creating extension and function...');

    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.f_unaccent(text)
        RETURNS text AS
      $func$
      SELECT public.unaccent('public.unaccent', $1)
      $func$  LANGUAGE sql IMMUTABLE;
    `);

    console.log('Success! Extension and function created.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

init();
