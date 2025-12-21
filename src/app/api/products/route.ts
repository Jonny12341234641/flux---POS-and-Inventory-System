import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';


// 1. GET: Fetch all products
export async function GET() {
  const { data, error } = await supabase.from('products').select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 2. POST: Create a new product
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Ideally, we will call a Controller here later:
    // const newProduct = await createProduct(body);

    // For now, let's just test the input:
    const { data, error } = await supabase
      .from('products')
      .insert([body])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Product Created", product: data[0] }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: "Invalid Request Body" }, { status: 400 });
  }
}