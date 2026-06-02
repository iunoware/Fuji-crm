import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { inventorySchema } from './schema';

// Mock Auth: Reads user ID from Postman headers and fetches their role from local DB
async function getLocalUser(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return { error: 'Missing x-user-id header', status: 401 };

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (rows.length === 0) return { error: 'User not found in local DB', status: 404 };

  return { user: rows[0], status: 200 };
}

// GET: Fetch Inventory
export async function GET(request: Request) {
  const { user, error, status } = await getLocalUser(request);
  if (error) return NextResponse.json({ error }, { status });

  try {
    let query = `
      SELECT i.id, i.available_quantity, i.city_id, 
             n.name as item_name, c.name as category, b.name as brand, u.name as unit
      FROM inventory i
      JOIN item_names n ON i.item_name_id = n.id
      JOIN categories c ON i.category_id = c.id
      LEFT JOIN brands b ON i.brand_id = b.id
      JOIN units u ON i.unit_id = u.id
    `;
    const params: any[] = [];

    // RBAC: If not Super Admin, strictly limit to their city
    if (user.role !== 'Super Admin') {
      query += ` WHERE i.city_id = $1`;
      params.push(user.city_id);
    }
    
    query += ` ORDER BY i.created_at DESC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add New Inventory
export async function POST(request: Request) {
  const { user, error, status } = await getLocalUser(request);
  if (error) return NextResponse.json({ error }, { status });

  if (user.role === 'Staff') {
    return NextResponse.json({ error: 'Forbidden: Staff cannot add stock' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = inventorySchema.parse(body);

    if (user.role === 'City Admin' && validated.city_id !== user.city_id) {
      return NextResponse.json({ error: 'Forbidden: You can only add stock to your assigned city' }, { status: 403 });
    }

    const insertQuery = `
      INSERT INTO inventory (item_name_id, category_id, brand_id, unit_id, available_quantity, total_quantity, city_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const values = [
      validated.item_name_id, validated.category_id, validated.brand_id || null, 
      validated.unit_id, validated.available_quantity, validated.available_quantity, validated.city_id
    ];

    const { rows } = await pool.query(insertQuery, values);
    return NextResponse.json({ data: rows[0], message: 'Stock added successfully' }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: err.errors || err.message }, { status: 400 });
  }
}