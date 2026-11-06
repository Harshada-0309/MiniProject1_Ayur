const { getPool, checkDatabaseConnection } = require('../config/database');
const { hashPassword } = require('../services/authService');

// Seeded authorized dietitian practitioners for the clinic
const INITIAL_DIETITIANS = [
  {
    id: 1,
    dietitian_code: 'DIET-2026-001',
    name: 'Dr. Vaidya',
    email: 'vaidya@ayurdiet.clinic',
    password_hash: hashPassword(process.env.DIETITIAN_PASSWORD || 'AyurDiet@2026'),
    role: 'Chief Clinical Dietitian',
    clinic_name: 'AyurDiet Integrative Health Clinic',
    phone: '+91 98765 43210',
    qualifications: 'BAMS, MD (Ayurveda), PGD Clinical Nutrition',
    photo_url: '/images/dietitian-hero-doctor.jpg',
    is_active: true,
  },
  {
    id: 2,
    dietitian_code: 'DIET-2026-002',
    name: 'Dr. Rajesh Sharma',
    email: 'dr.sharma@ayurdiet.clinic',
    password_hash: hashPassword(process.env.DIETITIAN_PASSWORD || 'AyurDiet@2026'),
    role: 'Senior Ayurvedic Consultant',
    clinic_name: 'AyurDiet Holistic Wellness Center',
    phone: '+91 98111 22334',
    qualifications: 'BAMS, PhD (Dravyaguna), Certified Ayurvedic Dietitian',
    photo_url: '/images/dietitian-hero-doctor.jpg',
    is_active: true,
  },
];

// In-memory fallback store for offline development and hermetic test runs
let memoryDietitians = INITIAL_DIETITIANS.map((d) => ({
  ...d,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

async function isDbConnected() {
  try {
    const health = await checkDatabaseConnection();
    return health.connected;
  } catch {
    return false;
  }
}

const dietitianRepository = {
  /**
   * Reset in-memory store (useful for tests)
   */
  _resetMemoryStore() {
    memoryDietitians = INITIAL_DIETITIANS.map((d) => ({
      ...d,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  },

  /**
   * Seed authorized practitioners into PostgreSQL if they do not exist
   */
  async seedDefaults() {
    const connected = await isDbConnected();
    if (!connected) {
      console.log('[DietitianRepository] Database not connected. Default practitioners kept in memory.');
      return;
    }

    try {
      const pool = getPool();
      for (const d of INITIAL_DIETITIANS) {
        await pool.query(
          `INSERT INTO dietitians (id, dietitian_code, name, email, password_hash, role, clinic_name, phone, qualifications, photo_url, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (email) DO UPDATE
           SET role = EXCLUDED.role,
               clinic_name = EXCLUDED.clinic_name,
               phone = COALESCE(dietitians.phone, EXCLUDED.phone),
               qualifications = COALESCE(dietitians.qualifications, EXCLUDED.qualifications),
               is_active = true`,
          [
            d.id,
            d.dietitian_code,
            d.name,
            d.email.toLowerCase(),
            d.password_hash,
            d.role,
            d.clinic_name,
            d.phone,
            d.qualifications,
            d.photo_url,
            d.is_active,
          ]
        );
      }

      // Synchronize postgres sequence to highest ID
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('dietitians', 'id'),
          COALESCE((SELECT MAX(id) FROM dietitians), 1)
        );
      `);

      if (process.env.NODE_ENV === 'production' && (!process.env.DIETITIAN_PASSWORD || process.env.DIETITIAN_PASSWORD === 'AyurDiet@2026')) {
        console.warn(
          '[Security Warning] Production deployment is using the default seeded practitioner password. ' +
          'Configure a unique DIETITIAN_PASSWORD in the production environment variables.'
        );
      }

      console.log('[DietitianRepository] Default authorized practitioners verified and seeded in PostgreSQL.');
    } catch (err) {
      console.warn('[DietitianRepository] Seed defaults warning:', err.message);
    }
  },

  /**
   * Find a dietitian by email address
   */
  async findByEmail(email) {
    if (!email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT * FROM dietitians WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
          [normalizedEmail]
        );
        if (res.rows.length > 0) {
          return res.rows[0];
        }
        // If query succeeded and returned 0 rows, user truly doesn't exist in DB
        return null;
      } catch (err) {
        console.warn('[DietitianRepository] DB query failed, falling back to memory store:', err.message);
      }
    }

    return (
      memoryDietitians.find(
        (d) => d.email.toLowerCase() === normalizedEmail && d.is_active
      ) || null
    );
  },

  /**
   * Find a dietitian by primary ID
   */
  async findById(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT id, dietitian_code, name, email, role, clinic_name, phone, qualifications, photo_url, is_active, created_at, updated_at
           FROM dietitians WHERE id = $1 AND is_active = true LIMIT 1`,
          [numId]
        );
        if (res.rows.length > 0) {
          return res.rows[0];
        }
        return null;
      } catch (err) {
        console.warn('[DietitianRepository] DB query failed, falling back to memory store:', err.message);
      }
    }

    const found = memoryDietitians.find((d) => d.id === numId && d.is_active);
    if (!found) return null;

    const { password_hash, ...safeDietitian } = found;
    return safeDietitian;
  },

  /**
   * List all active dietitians (for directory or switching)
   */
  async findAll() {
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT id, dietitian_code, name, email, role, clinic_name, phone, qualifications, photo_url, is_active, created_at
           FROM dietitians WHERE is_active = true ORDER BY id ASC`
        );
        return res.rows;
      } catch (err) {
        console.warn('[DietitianRepository] DB findAll failed, falling back to memory:', err.message);
      }
    }

    return memoryDietitians
      .filter((d) => d.is_active)
      .map(({ password_hash, ...safe }) => safe);
  },

  /**
   * Update dietitian profile
   */
  async updateProfile(id, data) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return null;
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const setClauses = [];
        const params = [];

        if (data.name !== undefined) {
          params.push(data.name ? data.name.trim() : '');
          setClauses.push(`name = $${params.length}`);
        }
        if (data.phone !== undefined) {
          params.push(data.phone ? data.phone.trim() : null);
          setClauses.push(`phone = $${params.length}`);
        }
        if (data.qualifications !== undefined) {
          params.push(data.qualifications ? data.qualifications.trim() : null);
          setClauses.push(`qualifications = $${params.length}`);
        }
        if (data.clinic_name !== undefined) {
          params.push(data.clinic_name ? data.clinic_name.trim() : null);
          setClauses.push(`clinic_name = $${params.length}`);
        }
        if (data.photo_url !== undefined) {
          params.push(data.photo_url || null);
          setClauses.push(`photo_url = $${params.length}`);
        }
        if (data.role !== undefined) {
          params.push(data.role ? data.role.trim() : null);
          setClauses.push(`role = $${params.length}`);
        }

        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(numId);

        const res = await pool.query(
          `UPDATE dietitians
           SET ${setClauses.join(', ')}
           WHERE id = $${params.length} AND is_active = true
           RETURNING id, dietitian_code, name, email, role, clinic_name, phone, qualifications, photo_url, is_active, created_at, updated_at`,
          params
        );
        if (res.rows.length > 0) {
          // Sync with memory store if cached
          const mem = memoryDietitians.find((d) => d.id === numId);
          if (mem) {
            Object.assign(mem, res.rows[0]);
          }
          return res.rows[0];
        }
      } catch (err) {
        console.warn('[DietitianRepository] DB update failed, falling back to memory store:', err.message);
      }
    }

    const found = memoryDietitians.find((d) => d.id === numId && d.is_active);
    if (!found) return null;

    if (data.name !== undefined) found.name = data.name ? data.name.trim() : found.name;
    if (data.phone !== undefined) found.phone = data.phone ? data.phone.trim() : '';
    if (data.qualifications !== undefined) found.qualifications = data.qualifications ? data.qualifications.trim() : '';
    if (data.clinic_name !== undefined) found.clinic_name = data.clinic_name ? data.clinic_name.trim() : '';
    if (data.photo_url !== undefined) found.photo_url = data.photo_url || null;
    if (data.role !== undefined) found.role = data.role ? data.role.trim() : found.role;
    found.updated_at = new Date().toISOString();

    const { password_hash, ...safeDietitian } = found;
    return safeDietitian;
  },

  /**
   * Create a new dietitian practitioner
   */
  async create(data) {
    const connected = await isDbConnected();
    const hash = data.password_hash || hashPassword(data.password || 'AyurDiet@2026');
    const normalizedEmail = (data.email || '').trim().toLowerCase();

    if (connected) {
      try {
        const pool = getPool();
        const codeRes = await pool.query(
          `SELECT 'DIET-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(COALESCE(MAX(id) + 1, 1)::text, 3, '0') as next_code FROM dietitians`
        );
        const code = data.dietitian_code || codeRes.rows[0].next_code;

        const res = await pool.query(
          `INSERT INTO dietitians (dietitian_code, name, email, password_hash, role, clinic_name, phone, qualifications, photo_url, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, dietitian_code, name, email, role, clinic_name, phone, qualifications, photo_url, is_active, created_at, updated_at`,
          [
            code,
            data.name,
            normalizedEmail,
            hash,
            data.role || 'Clinical Dietitian',
            data.clinic_name || 'AyurDiet Integrative Health Clinic',
            data.phone || null,
            data.qualifications || null,
            data.photo_url || '/images/dietitian-hero-doctor.jpg',
            true,
          ]
        );
        return res.rows[0];
      } catch (err) {
        console.warn('[DietitianRepository] DB insert failed, falling back to memory store:', err.message);
      }
    }

    const nextId = memoryDietitians.length > 0 ? Math.max(...memoryDietitians.map((d) => d.id)) + 1 : 1;
    const code = data.dietitian_code || `DIET-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`;
    const newDoc = {
      id: nextId,
      dietitian_code: code,
      name: data.name,
      email: normalizedEmail,
      password_hash: hash,
      role: data.role || 'Clinical Dietitian',
      clinic_name: data.clinic_name || 'AyurDiet Integrative Health Clinic',
      phone: data.phone || '',
      qualifications: data.qualifications || '',
      photo_url: data.photo_url || '/images/dietitian-hero-doctor.jpg',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryDietitians.push(newDoc);
    const { password_hash, ...safe } = newDoc;
    return safe;
  },
};

module.exports = dietitianRepository;
