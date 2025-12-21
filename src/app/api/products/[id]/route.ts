import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// 1. GET: Fetch ONE product by ID
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// 2. DELETE: Remove a product
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Product Deleted Successfully" });
}

// 3. PUT: Update a product
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('products')
    .update(body)
    .eq('id', params.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Product Updated", product: data });
}