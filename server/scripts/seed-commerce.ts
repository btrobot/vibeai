import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai';

console.log('Seeding commerce data...');

const sql = postgres(databaseUrl, { max: 1 });

async function seed() {
  // ===== Seed Product Categories =====
  console.log('Creating product categories...');

  const categories = [
    // 顶级分类
    {
      id: uuidv4(),
      name: '服装',
      slug: 'clothing',
      icon: '👔',
      attributes: {
        size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        color: ['黑色', '白色', '红色', '蓝色', '灰色'],
        season: ['春季', '夏季', '秋季', '冬季'],
      },
      sort_order: 1,
      parent_id: null,
    },
    {
      id: uuidv4(),
      name: '电子产品',
      slug: 'electronics',
      icon: '📱',
      attributes: {
        brand: ['Apple', 'Samsung', 'Huawei', 'Xiaomi'],
        storage: ['64GB', '128GB', '256GB', '512GB'],
        color: ['黑色', '白色', '蓝色', '红色'],
      },
      sort_order: 2,
      parent_id: null,
    },
    {
      id: uuidv4(),
      name: '家居用品',
      slug: 'home-garden',
      icon: '🏠',
      attributes: {
        material: ['木质', '金属', '塑料', '布艺'],
        style: ['现代', '简约', '欧式', '中式'],
      },
      sort_order: 3,
      parent_id: null,
    },

    // 服装子分类
    {
      id: uuidv4(),
      name: '男装',
      slug: 'mens-clothing',
      icon: '👔',
      attributes: {
        size: ['S', 'M', 'L', 'XL', 'XXL'],
        category: ['T恤', '衬衫', '裤子', '外套'],
      },
      sort_order: 1,
      parent_id: 'clothing', // Will be replaced with actual UUID
    },
    {
      id: uuidv4(),
      name: '女装',
      slug: 'womens-clothing',
      icon: '👗',
      attributes: {
        size: ['XS', 'S', 'M', 'L', 'XL'],
        category: ['连衣裙', '上衣', '裤子', '外套'],
      },
      sort_order: 2,
      parent_id: 'clothing',
    },
    {
      id: uuidv4(),
      name: '童装',
      slug: 'kids-clothing',
      icon: '👶',
      attributes: {
        size: ['90cm', '100cm', '110cm', '120cm', '130cm'],
        age: ['3-4岁', '5-6岁', '7-8岁', '9-10岁'],
      },
      sort_order: 3,
      parent_id: 'clothing',
    },

    // 电子产品子分类
    {
      id: uuidv4(),
      name: '手机',
      slug: 'smartphones',
      icon: '📱',
      attributes: {
        brand: ['Apple', 'Samsung', 'Huawei', 'Xiaomi'],
        screen_size: ['5.5英寸', '6.1英寸', '6.7英寸'],
        ram: ['4GB', '6GB', '8GB', '12GB'],
      },
      sort_order: 1,
      parent_id: 'electronics',
    },
    {
      id: uuidv4(),
      name: '电脑',
      slug: 'computers',
      icon: '💻',
      attributes: {
        brand: ['Apple', 'Dell', 'HP', 'Lenovo'],
        ram: ['8GB', '16GB', '32GB'],
        storage: ['256GB', '512GB', '1TB'],
      },
      sort_order: 2,
      parent_id: 'electronics',
    },
  ];

  // First insert top-level categories and get their IDs
  const topLevelCategories = categories.filter((c) => c.parent_id === null);
  const categoryMap = new Map<string, string>();

  for (const category of topLevelCategories) {
    const [inserted] = await sql`
      INSERT INTO product_categories (id, name, slug, icon, attributes, sort_order, is_active, parent_id, created_at, updated_at)
      VALUES (${category.id}, ${category.name}, ${category.slug}, ${category.icon}, ${JSON.stringify(category.attributes)}, ${category.sort_order}, true, NULL, NOW(), NOW())
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `;
    if (inserted) {
      categoryMap.set(category.slug, inserted.id);
    }
  }

  // Then insert child categories with correct parent IDs
  const childCategories = categories.filter((c) => c.parent_id !== null);
  for (const category of childCategories) {
    const parentSlug = category.parent_id!;
    const parentId = categoryMap.get(parentSlug);

    if (parentId) {
      const [inserted] = await sql`
        INSERT INTO product_categories (id, name, slug, icon, attributes, sort_order, is_active, parent_id, created_at, updated_at)
        VALUES (${category.id}, ${category.name}, ${category.slug}, ${category.icon}, ${JSON.stringify(category.attributes)}, ${category.sort_order}, true, ${parentId}, NOW(), NOW())
        ON CONFLICT (slug) DO NOTHING
        RETURNING id
      `;
    }
  }

  console.log(`✅ Created ${categories.length} product categories`);

  // ===== Seed Promo Codes =====
  console.log('Creating promo codes...');

  const promoCodes = [
    {
      code: 'WELCOME2024',
      type: 'percentage',
      value: 15,
      max_uses: 1000,
      valid_from: new Date('2026-01-01'),
      valid_until: new Date('2026-12-31'),
      min_amount: 50,
    },
    {
      code: 'SUMMER20',
      type: 'percentage',
      value: 20,
      max_uses: 500,
      valid_from: new Date('2026-06-01'),
      valid_until: new Date('2026-08-31'),
      min_amount: 100,
    },
    {
      code: 'FLAT10',
      type: 'fixed',
      value: 10,
      max_uses: null,
      valid_from: new Date('2026-01-01'),
      valid_until: null,
      min_amount: 30,
    },
    {
      code: 'NEWUSER',
      type: 'percentage',
      value: 25,
      max_uses: 100,
      valid_from: new Date('2026-01-01'),
      valid_until: new Date('2026-12-31'),
      min_amount: 50,
    },
  ];

  for (const promo of promoCodes) {
    await sql`
      INSERT INTO promo_codes (code, type, value, max_uses, used_count, valid_from, valid_until, min_amount, is_active, created_at, updated_at)
      VALUES (${promo.code}, ${promo.type}, ${promo.value}, ${promo.max_uses}, 0, ${promo.valid_from}, ${promo.valid_until}, ${promo.min_amount}, true, NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `;
  }

  console.log(`✅ Created ${promoCodes.length} promo codes`);

  // ===== Get a user ID for sample products =====
  const [user] = await sql`SELECT id FROM users LIMIT 1`;

  if (!user) {
    console.log('⚠️  No users found, skipping product seed');
  } else {
    // ===== Seed Sample Products =====
    console.log('Creating sample products...');

    // Get category IDs
    const [mensCategory] = await sql`SELECT id FROM product_categories WHERE slug = 'mens-clothing' LIMIT 1`;
    const [womensCategory] = await sql`SELECT id FROM product_categories WHERE slug = 'womens-clothing' LIMIT 1`;
    const [phoneCategory] = await sql`SELECT id FROM product_categories WHERE slug = 'smartphones' LIMIT 1`;

    const products = [
      {
        user_id: user.id,
        name: '经典纯棉T恤',
        description: '采用优质纯棉面料，舒适透气，适合日常穿着。简约设计，百搭时尚。',
        category_id: mensCategory?.id || null,
        images: [uuidv4(), uuidv4()],
        status: 'active',
        metadata: {
          brand: 'Uniqlo',
          material: '100% Cotton',
          sizes: ['S', 'M', 'L', 'XL'],
          colors: ['白色', '黑色', '灰色'],
        },
      },
      {
        user_id: user.id,
        name: '时尚连衣裙',
        description: '优雅设计，完美展现女性魅力。采用高品质面料，舒适亲肤。',
        category_id: womensCategory?.id || null,
        images: [uuidv4(), uuidv4(), uuidv4()],
        status: 'active',
        metadata: {
          brand: 'Zara',
          material: 'Polyester',
          sizes: ['XS', 'S', 'M', 'L'],
          colors: ['红色', '黑色', '白色'],
          style: '夏季新款',
        },
      },
      {
        user_id: user.id,
        name: '智能手机 Pro',
        description: '最新款智能手机，搭载旗舰处理器，拍照效果出众。',
        category_id: phoneCategory?.id || null,
        images: [uuidv4(), uuidv4()],
        status: 'active',
        metadata: {
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          storage: '256GB',
          color: '深空黑',
          screen_size: '6.1英寸',
        },
      },
      {
        user_id: user.id,
        name: '商务休闲衬衫',
        description: '专为商务人士打造，挺括有型，彰显专业气质。',
        category_id: mensCategory?.id || null,
        images: [uuidv4()],
        status: 'active',
        metadata: {
          brand: 'Hugo Boss',
          material: 'Cotton Blend',
          sizes: ['M', 'L', 'XL', 'XXL'],
          colors: ['白色', '浅蓝'],
          fit: '修身',
        },
      },
      {
        user_id: user.id,
        name: '运动休闲裤',
        description: '舒适面料，时尚剪裁，适合运动和休闲场合。',
        category_id: mensCategory?.id || null,
        images: [uuidv4(), uuidv4()],
        status: 'draft',
        metadata: {
          brand: 'Nike',
          material: 'Polyester',
          sizes: ['M', 'L', 'XL'],
          colors: ['黑色', '灰色', '深蓝'],
        },
      },
    ];

    for (const product of products) {
      await sql`
        INSERT INTO products (id, user_id, name, description, category_id, images, status, metadata, created_at, updated_at)
        VALUES (${uuidv4()}, ${product.user_id}, ${product.name}, ${product.description}, ${product.category_id}, ${JSON.stringify(product.images)}, ${product.status}, ${JSON.stringify(product.metadata)}, NOW(), NOW())
      `;
    }

    console.log(`✅ Created ${products.length} sample products`);
  }

  console.log('\n✨ Commerce data seeding completed!\n');
  await sql.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed!', err);
  process.exit(1);
});
