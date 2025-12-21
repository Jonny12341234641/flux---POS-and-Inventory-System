import { supabase } from '../lib/supabase';
import { Category } from '../types/index'; // Using the Types we defined earlier

// This is a "Server Component". It runs on the server, fetches data, and sends HTML to the browser.
export default async function Home() {
  
  // 1. Fetch data directly from Supabase
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error("Error fetching categories:", error);
  }

  return (
    <main className="min-h-screen p-10 bg-gray-50">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900">Flux POS</h1>
        <p className="text-gray-500">System Status: <span className="text-green-600 font-bold">Online</span></p>
      </div>

      {/* Category Grid */}
      <h2 className="text-2xl font-bold mb-4">Inventory Categories</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories?.map((category: Category) => (
          <div 
            key={category.id} 
            className="p-6 bg-white rounded-lg shadow-md border-l-4"
            style={{ borderLeftColor: category.color_code || '#000' }} // Uses the color code from DB
          >
            <h3 className="text-xl font-bold">{category.name}</h3>
            <p className="text-gray-600 mt-2">{category.description}</p>
            <div className="mt-4 text-xs text-gray-400">ID: {category.id}</div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {categories?.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No categories found. Check your database connection.
        </div>
      )}

    </main>
  );
}