// backend/seed-active-menu.js
const { Client } = require('pg');
const Redis = require('ioredis');

const pgClient = new Client({
  connectionString: 'postgresql://postgres:159600@localhost:5432/cafeq',
});

const redisClient = new Redis('redis://localhost:6379');

async function main() {
  await pgClient.connect();

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Delete existing active menus/dishes for today to allow re-seeding
  await pgClient.query('UPDATE menus SET is_active = false');
  await pgClient.query('DELETE FROM menus WHERE publish_date = $1', [todayStr]);

  // 2. Insert Menu for today
  const menuRes = await pgClient.query(
    `INSERT INTO menus (publish_date, is_active)
     VALUES ($1, true)
     RETURNING id`,
    [todayStr]
  );
  const menuId = menuRes.rows[0].id;
  console.log(`Created Active Menu for ${todayStr} with ID: ${menuId}`);

  // 3. Define dishes to insert
  const dishes = [
    {
      name: 'Beef Stew with Chapati',
      description: 'Slow-cooked tender beef stew served with two warm, soft chapatis.',
      price: 250.00,
      dietaryTags: ['Halal'],
      preparedQuantity: 50,
    },
    {
      name: 'Chicken Biryani',
      description: 'Fragrant basmati rice cooked with spiced chicken, herbs, and aromatics.',
      price: 350.00,
      dietaryTags: ['Halal'],
      preparedQuantity: 40,
    },
    {
      name: 'Traditional Ugali & Sukuma Wiki',
      description: 'White cornmeal ugali served with seasoned collard greens (sukuma wiki) and traditional salsa (kachumbari).',
      price: 150.00,
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
      preparedQuantity: 60,
    },
    {
      name: 'Bean Curry & Rice',
      description: 'Creamy coconut bean curry served with steamed white rice.',
      price: 180.00,
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      preparedQuantity: 45,
    },
    {
      name: 'Tropical Fruit Salad',
      description: 'A refreshing mix of diced pineapple, watermelon, mango, and sweet papaya.',
      price: 120.00,
      dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free'],
      preparedQuantity: 30,
    }
  ];

  // 4. Insert dishes and set Redis availability
  for (const d of dishes) {
    const dishRes = await pgClient.query(
      `INSERT INTO dishes (menu_id, name, description, price, dietary_tags, prepared_quantity, is_sold_out)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [menuId, d.name, d.description, d.price, d.dietaryTags, d.preparedQuantity]
    );
    const dishId = dishRes.rows[0].id;

    // Set Redis key for live availability
    const redisKey = `dish:availability:${dishId}`;
    await redisClient.set(redisKey, d.preparedQuantity);
    console.log(`Seeded dish "${d.name}" with ID: ${dishId} (Qty: ${d.preparedQuantity})`);
  }

  console.log('Successfully seeded active menu and synced portion counts in Redis!');
  await pgClient.end();
  await redisClient.quit();
}

main().catch(err => {
  console.error('Error seeding menu:', err);
  pgClient.end();
  redisClient.quit();
});
