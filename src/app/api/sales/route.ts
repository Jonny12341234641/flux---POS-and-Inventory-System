// import { NextResponse } from 'next/server';
// import { createSale } from '../../../lib/controllers/saleController';

// export async function POST(request: Request) {
//   try {
//     const body = await request.json();

//     const result = await createSale(body);
//     return NextResponse.json({ message: "Sale processed successfully", ...result }, { status: 201 });

//   } catch (error) {
//     const message = error instanceof Error ? error.message : "Failed to process sale";
//     return NextResponse.json({ error: message }, { status: 500 });
//   }
// }

//Above is the code given by Codex below is given by Gemini

import { NextResponse } from 'next/server';
import { createSale } from '../../../lib/controllers/saleController'; // Import the Chef

/**
 * POST /api/sales
 * Create a new sale
 * @param {Request} request - The Next.js request object
 * @returns {Promise<NextResponse>} - The response with the created sale data
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Call the Controller to handle all the logic
    const result = await createSale(body);

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
